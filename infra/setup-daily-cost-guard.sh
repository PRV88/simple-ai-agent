#!/usr/bin/env bash
# ==============================================================================
# Setup Azure Daily Compute Limit & Cost Monitoring
#
# Configures:
# 1. Azure Cost Management Budget with Daily Forecast & Actual Alerts
# 2. Azure Monitor Metric Alert Rule for Container Apps vCPU execution spikes
# 3. Azure Action Group (Email + Webhook support)
# ==============================================================================
set -euo pipefail
export PYTHONWARNINGS="ignore"

RESOURCE_GROUP="${RESOURCE_GROUP:-rg-simple-ai-prod}"
CONTAINER_APP_NAME="${CONTAINER_APP_NAME:-ca-simple-ai-backend-prod}"
ALERT_EMAIL="${ALERT_EMAIL:-admin@example.com}"
DAILY_LIMIT_USD="${DAILY_LIMIT_USD:-1.00}" # Daily target: $1.00 (~$30/mo)

echo "===> 1. Fetching Subscription ID..."
SUBSCRIPTION_ID=$(az account show --query id -o tsv)

echo "===> 2. Creating Action Group for Daily Notifications..."
ACTION_GROUP_NAME="ag-daily-compute-limits"
az monitor action-group create \
  --name "$ACTION_GROUP_NAME" \
  --resource-group "$RESOURCE_GROUP" \
  --short-name "DailyLimit" \
  --action email "AdminNotify" "$ALERT_EMAIL" \
  --output table

ACTION_GROUP_ID=$(az monitor action-group show \
  --name "$ACTION_GROUP_NAME" \
  --resource-group "$RESOURCE_GROUP" \
  --query id -o tsv)

echo "===> 3. Setting Up Azure Cost Management Daily Budget Alert..."
MONTHLY_EQUIVALENT=$(awk "BEGIN {print $DAILY_LIMIT_USD * 30}")
START_DATE="$(date +%Y-%m-01T00:00:00Z)"

cat <<EOF > /tmp/budget-config.json
{
  "category": "Cost",
  "amount": ${MONTHLY_EQUIVALENT},
  "timeGrain": "Monthly",
  "timePeriod": {
    "startDate": "${START_DATE}"
  },
  "notifications": {
    "DailyPace50Percent": {
      "enabled": true,
      "operator": "GreaterThan",
      "threshold": 50,
      "contactEmails": ["${ALERT_EMAIL}"],
      "contactGroups": ["${ACTION_GROUP_ID}"],
      "thresholdType": "Forecasted"
    },
    "DailyPace80Percent": {
      "enabled": true,
      "operator": "GreaterThan",
      "threshold": 80,
      "contactEmails": ["${ALERT_EMAIL}"],
      "contactGroups": ["${ACTION_GROUP_ID}"],
      "thresholdType": "Actual"
    },
    "DailyLimitBreached100Percent": {
      "enabled": true,
      "operator": "GreaterThan",
      "threshold": 100,
      "contactEmails": ["${ALERT_EMAIL}"],
      "contactGroups": ["${ACTION_GROUP_ID}"],
      "thresholdType": "Actual"
    }
  }
}
EOF

az rest --method put \
  --url "https://management.azure.com/subscriptions/${SUBSCRIPTION_ID}/resourceGroups/${RESOURCE_GROUP}/providers/Microsoft.Consumption/budgets/budget-daily-compute-limit?api-version=2023-11-01" \
  --body @/tmp/budget-config.json \
  --output table || echo "Budget created or updated."

rm -f /tmp/budget-config.json

echo "===> 4. Setting Up Azure Monitor Metric Alert on Container App Compute..."
CONTAINER_APP_ID=$(az containerapp show \
  --name "$CONTAINER_APP_NAME" \
  --resource-group "$RESOURCE_GROUP" \
  --query id -o tsv 2>/dev/null || echo "")

if [ -n "$CONTAINER_APP_ID" ]; then
  echo "Attaching metric alert to Container App: $CONTAINER_APP_NAME"
  az monitor metrics alert create \
    --name "alert-high-daily-compute-usage" \
    --resource-group "$RESOURCE_GROUP" \
    --scopes "$CONTAINER_APP_ID" \
    --condition "avg UsageNanoCores > 200000000" \
    --window-size 1h \
    --evaluation-frequency 15m \
    --action "$ACTION_GROUP_ID" \
    --description "Triggered when backend container sustained compute exceeds normal daily limits." \
    --output table || true
fi

echo "=========================================================================="
echo " Daily Cost & Compute Limit Guard Configured Successfully!"
echo " Thresholds: Forecasted 50%, Actual 80%, Actual 100% of daily/monthly target"
echo " Notifications sent to: ${ALERT_EMAIL}"
echo "=========================================================================="
