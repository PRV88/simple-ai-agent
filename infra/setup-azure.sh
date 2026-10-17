#!/usr/bin/env bash
# ==============================================================================
# Azure Low-Cost Infrastructure Bootstrap Script
# - Deploys Azure Static Web Apps (Global Azure CDN)
# - Deploys Azure Container Apps (Serverless Consumption, scale-to-zero, max 2 replicas)
# - Sets up Azure Budget Alert to monitor daily compute & cost limits
# ==============================================================================
set -euo pipefail

# Configurations
RESOURCE_GROUP="${RESOURCE_GROUP:-rg-simple-ai-prod}"
LOCATION="${LOCATION:-eastus2}"
APP_NAME="${APP_NAME:-simple-ai}"
ENVIRONMENT="${ENVIRONMENT:-prod}"
ALERT_EMAIL="${ALERT_EMAIL:-admin@example.com}"
MONTHLY_BUDGET_USD="${MONTHLY_BUDGET_USD:-15}" # ~$0.50/day

export PYTHONWARNINGS="ignore"

echo "===> 1. Verifying Azure CLI login..."
if ! az account show > /dev/null 2>&1; then
    echo "Error: You are not logged in to Azure. Please run 'az login' first."
    exit 1
fi

SUBSCRIPTION_ID=$(az account show --query id -o tsv)
echo "Active Subscription: ${SUBSCRIPTION_ID}"

echo "===> 2. Ensuring required Azure resource providers are registered..."
for ns in Microsoft.App Microsoft.OperationalInsights Microsoft.ContainerRegistry Microsoft.Web Microsoft.Consumption Microsoft.Insights; do
    state=$(az provider show --namespace "$ns" --query "registrationState" -o tsv 2>/dev/null || echo "NotRegistered")
    if [ "$state" != "Registered" ]; then
        echo "Registering provider: $ns (current: $state)..."
        az provider register --namespace "$ns"
    else
        echo "Provider $ns is already registered."
    fi
done

echo "===> 3. Preparing Resource Group: ${RESOURCE_GROUP}..."
EXISTING_RG_LOCATION=$(az group show --name "${RESOURCE_GROUP}" --query location -o tsv 2>/dev/null || true)

if [ -n "$EXISTING_RG_LOCATION" ]; then
    echo "Resource Group '${RESOURCE_GROUP}' already exists in location '${EXISTING_RG_LOCATION}'."
    LOCATION="$EXISTING_RG_LOCATION"
else
    echo "Creating Resource Group: ${RESOURCE_GROUP} (${LOCATION})..."
    az group create --name "${RESOURCE_GROUP}" --location "${LOCATION}" --output table
fi

echo "===> 4. Deploying Bicep Template..."
DEPLOY_OUTPUT=$(az deployment group create \
  --resource-group "${RESOURCE_GROUP}" \
  --template-file "$(dirname "$0")/main.bicep" \
  --parameters \
      location="${LOCATION}" \
      appName="${APP_NAME}" \
      environment="${ENVIRONMENT}" \
      alertEmail="${ALERT_EMAIL}" \
      monthlyBudgetAmount="${MONTHLY_BUDGET_USD}" \
  --query properties.outputs -o json)

ACR_LOGIN_SERVER=$(echo "$DEPLOY_OUTPUT" | jq -r '.acrLoginServer.value')
BACKEND_FQDN=$(echo "$DEPLOY_OUTPUT" | jq -r '.backendFqdn.value')
FRONTEND_HOSTNAME=$(echo "$DEPLOY_OUTPUT" | jq -r '.frontendDefaultHostname.value')

echo "===> 5. Fetching deployment credentials..."
SWA_NAME="swa-${APP_NAME}-frontend-${ENVIRONMENT}"
SWA_API_KEY=$(az staticwebapp secrets list --name "${SWA_NAME}" --resource-group "${RESOURCE_GROUP}" --query "properties.apiKey" -o tsv)

ACR_NAME=$(echo "$ACR_LOGIN_SERVER" | cut -d'.' -f1)
ACR_USERNAME=$(az acr credential show --name "$ACR_NAME" --query username -o tsv)
ACR_PASSWORD=$(az acr credential show --name "$ACR_NAME" --query "passwords[0].value" -o tsv)

echo "===> 6. Creating Service Principal for GitHub Actions..."
SP_NAME="sp-${APP_NAME}-github-actions"
SP_JSON=$(az ad sp create-for-rbac \
  --name "$SP_NAME" \
  --role contributor \
  --scopes "/subscriptions/${SUBSCRIPTION_ID}/resourceGroups/${RESOURCE_GROUP}" \
  --sdk-auth)

echo "=========================================================================="
echo " Azure Infrastructure Deployed Successfully! "
echo "=========================================================================="
echo "Backend URL:    ${BACKEND_FQDN}"
echo "Frontend (CDN): ${FRONTEND_HOSTNAME}"
echo "ACR Registry:   ${ACR_LOGIN_SERVER}"
echo ""
echo "=== Required GitHub Repository Secrets ==="
echo "Add the following secrets to your GitHub repository (Settings -> Secrets & Variables -> Actions):"
echo ""
echo "1. AZURE_CREDENTIALS:"
echo "$SP_JSON"
echo ""
echo "2. AZURE_STATIC_WEB_APPS_API_TOKEN:"
echo "$SWA_API_KEY"
echo ""
echo "3. ACR_LOGIN_SERVER:"
echo "$ACR_LOGIN_SERVER"
echo ""
echo "4. ACR_USERNAME:"
echo "$ACR_USERNAME"
echo ""
echo "5. ACR_PASSWORD:"
echo "$ACR_PASSWORD"
echo ""
echo "6. RESOURCE_GROUP:"
echo "$RESOURCE_GROUP"
echo ""
echo "7. CONTAINER_APP_NAME:"
echo "ca-${APP_NAME}-backend-${ENVIRONMENT}"
echo "=========================================================================="
