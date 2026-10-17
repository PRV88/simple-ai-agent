targetScope = 'resourceGroup'

@description('Application environment name (e.g. prod, staging, dev)')
param environment string = 'prod'

@description('Azure Region for resource deployment')
param location string = resourceGroup().location

@description('Azure Region for Static Web App (must be eastus2, centralus, westus2, westeurope, or eastasia)')
param staticWebAppLocation string = (location == 'eastus' ? 'eastus2' : (location == 'westeurope' || location == 'eastasia' || location == 'centralus' || location == 'westus2' || location == 'eastus2' ? location : 'eastus2'))

@description('Base name for resources')
param appName string = 'simple-ai'

@description('Email address to receive daily cost and compute threshold alerts')
param alertEmail string = 'admin@example.com'

@description('Monthly spending budget in USD (evaluated against daily pace, e.g. 15 USD = ~0.50 USD/day)')
param monthlyBudgetAmount int = 15

@description('Docker image for the backend container')
param backendImage string = 'mcr.microsoft.com/azuredocs/aci-helloworld:latest'

@description('Start date for monthly budget evaluation')
param budgetStartDate string = '${utcNow('yyyy-MM')}-01T00:00:00Z'

var uniqueSuffix = uniqueString(resourceGroup().id)
var rawAcrName = toLower(replace('acr${appName}${uniqueSuffix}', '-', ''))
var acrName = length(rawAcrName) > 50 ? substring(rawAcrName, 0, 50) : rawAcrName
var logAnalyticsName = 'law-${appName}-${environment}'
var containerAppEnvName = 'cae-${appName}-${environment}'
var containerAppName = 'ca-${appName}-backend-${environment}'
var staticWebAppName = 'swa-${appName}-frontend-${environment}'
var actionGroupName = 'ag-${appName}-daily-cost-alerts'
var budgetName = 'budget-${appName}-daily-limit'

// ============================================================================
// 1. Log Analytics Workspace (Minimal tier for low-cost diagnostics)
// ============================================================================
resource logAnalytics 'Microsoft.OperationalInsights/workspaces@2023-09-01' = {
  name: logAnalyticsName
  location: location
  properties: {
    sku: {
      name: 'PerGB2018'
    }
    retentionInDays: 30
  }
}

// ============================================================================
// 2. Azure Container Registry (Basic SKU - lowest cost container registry)
// ============================================================================
resource acr 'Microsoft.ContainerRegistry/registries@2023-07-01' = {
  name: acrName
  location: location
  sku: {
    name: 'Basic'
  }
  properties: {
    adminUserEnabled: true
  }
}

// ============================================================================
// 3. Azure Container Apps Environment (Consumption Serverless)
// ============================================================================
resource containerAppEnv 'Microsoft.App/managedEnvironments@2024-03-01' = {
  name: containerAppEnvName
  location: location
  properties: {
    appLogsConfiguration: {
      destination: 'log-analytics'
      logAnalyticsConfiguration: {
        customerId: logAnalytics.properties.customerId
        sharedKey: logAnalytics.listKeys().primarySharedKey
      }
    }
  }
}

// ============================================================================
// 4. Azure Container App - Backend (Serverless Scale-to-Zero, Low Cost)
// ============================================================================
resource containerApp 'Microsoft.App/containerApps@2024-03-01' = {
  name: containerAppName
  location: location
  identity: {
    type: 'SystemAssigned'
  }
  properties: {
    managedEnvironmentId: containerAppEnv.id
    configuration: {
      ingress: {
        external: true
        targetPort: 8000
        transport: 'auto'
        allowInsecure: false
      }
      secrets: [
        {
          name: 'acr-password'
          value: acr.listCredentials().passwords[0].value
        }
      ]
      registries: [
        {
          server: acr.properties.loginServer
          username: acr.listCredentials().username
          passwordSecretRef: 'acr-password'
        }
      ]
    }
    template: {
      containers: [
        {
          name: 'backend'
          image: backendImage
          resources: {
            cpu: json('0.25')
            memory: '0.5Gi'
          }
          env: [
            {
              name: 'APP_ENV'
              value: 'production'
            }
            {
              name: 'PORT'
              value: '8000'
            }
          ]
        }
      ]
      // Ultra low-cost scale-to-zero rule + concurrency cap
      scale: {
        minReplicas: 0
        maxReplicas: 2
        rules: [
          {
            name: 'http-scaling-rule'
            http: {
              metadata: {
                concurrentRequests: '50'
              }
            }
          }
        ]
      }
    }
  }
}

// ============================================================================
// 5. Azure Static Web App (Integrated Global Azure CDN - Free Tier)
// ============================================================================
resource staticWebApp 'Microsoft.Web/staticSites@2023-12-01' = {
  name: staticWebAppName
  location: staticWebAppLocation
  sku: {
    name: 'Free'
    tier: 'Free'
  }
  properties: {
    allowConfigFileUpdates: true
    stagingEnvironmentPolicy: 'Disabled'
  }
}

// ============================================================================
// 6. Action Group for Daily Cost & Compute Alert Notifications
// ============================================================================
resource actionGroup 'Microsoft.Insights/actionGroups@2023-01-01' = {
  name: actionGroupName
  location: 'Global'
  properties: {
    groupShortName: 'DailyAlerts'
    enabled: true
    emailReceivers: [
      {
        name: 'DailyAlertEmail'
        emailAddress: alertEmail
        useCommonAlertSchema: true
      }
    ]
  }
}

// ============================================================================
// 7. Cost Management Budget (Monitors Daily/Monthly Spending Limits)
// ============================================================================
resource budget 'Microsoft.Consumption/budgets@2023-11-01' = {
  name: budgetName
  properties: {
    timeGrain: 'Monthly'
    amount: monthlyBudgetAmount
    category: 'Cost'
    timePeriod: {
      startDate: budgetStartDate
    }
    notifications: {
      DailyPaceFiftyPercent: {
        enabled: true
        operator: 'GreaterThan'
        threshold: 50
        contactEmails: [
          alertEmail
        ]
        contactGroups: [
          actionGroup.id
        ]
        thresholdType: 'Forecasted'
      }
      ActualPaceEightyPercent: {
        enabled: true
        operator: 'GreaterThan'
        threshold: 80
        contactEmails: [
          alertEmail
        ]
        contactGroups: [
          actionGroup.id
        ]
        thresholdType: 'Actual'
      }
      ActualLimitBreached: {
        enabled: true
        operator: 'GreaterThan'
        threshold: 100
        contactEmails: [
          alertEmail
        ]
        contactGroups: [
          actionGroup.id
        ]
        thresholdType: 'Actual'
      }
    }
  }
}

// ============================================================================
// Outputs
// ============================================================================
output acrLoginServer string = acr.properties.loginServer
output backendFqdn string = 'https://${containerApp.properties.configuration.ingress.fqdn}'
output frontendDefaultHostname string = 'https://${staticWebApp.properties.defaultHostname}'
output staticWebAppDeploymentTokenSecretName string = 'AZURE_STATIC_WEB_APPS_API_TOKEN'
