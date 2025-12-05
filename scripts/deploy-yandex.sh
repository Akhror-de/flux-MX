#!/bin/bash
# Flux PWA Yandex Cloud Deployment Script
# For Node.js 22 Functions

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}🚀 Flux PWA Yandex Cloud Deployment${NC}"
echo -e "${BLUE}=====================================${NC}\n"

# Check Yandex CLI
if ! command -v yc &> /dev/null; then
    echo -e "${RED}❌ Yandex Cloud CLI not found. Please install:${NC}"
    echo -e "   curl -sSL https://storage.yandexcloud.net/yandexcloud-yc/install.sh | bash"
    exit 1
fi

# Check Node.js version
NODE_VERSION=$(node --version)
if [[ ! $NODE_VERSION =~ ^v22\. ]]; then
    echo -e "${YELLOW}⚠️  Warning: Node.js 22 is recommended. Current: $NODE_VERSION${NC}"
fi

# Function deployment
deploy_function() {
    local FUNCTION_NAME=$1
    local FUNCTION_PATH=$2
    local RUNTIME=$3
    local MEMORY=$4
    local TIMEOUT=$5
    
    echo -e "${BLUE}📦 Deploying $FUNCTION_NAME...${NC}"
    
    cd "$FUNCTION_PATH"
    
    # Install dependencies
    echo -e "${YELLOW}📦 Installing dependencies...${NC}"
    npm ci --only=production
    
    # Create deployment package
    echo -e "${YELLOW}📁 Creating deployment package...${NC}"
    zip -r function.zip . -x "*.git*" "*.env*" "node_modules/.bin/*" "*.test.js" "*.spec.js"
    
    # Deploy to Yandex Cloud
    echo -e "${YELLOW}☁️  Deploying to Yandex Cloud...${NC}"
    yc serverless function version create \
        --function-name="$FUNCTION_NAME" \
        --runtime="$RUNTIME" \
        --entrypoint="index.handler" \
        --memory="${MEMORY}m" \
        --execution-timeout="${TIMEOUT}s" \
        --package-name="function.zip" \
        --environment="NODE_ENV=production,NODE_VERSION=22" \
        --service-account-id="$YANDEX_SERVICE_ACCOUNT_ID"
    
    # Cleanup
    rm -f function.zip
    
    echo -e "${GREEN}✅ $FUNCTION_NAME deployed successfully${NC}"
    cd - > /dev/null
}

# Main deployment
main() {
    # Load environment
    if [ -f .env ]; then
        export $(cat .env | grep -v '^#' | xargs)
    fi
    
    # Required variables
    REQUIRED_VARS=("YANDEX_SERVICE_ACCOUNT_ID")
    
    for var in "${REQUIRED_VARS[@]}"; do
        if [ -z "${!var}" ]; then
            echo -e "${RED}❌ Missing required environment variable: $var${NC}"
            exit 1
        fi
    done
    
    # Deploy analyze-bpm function
    deploy_function \
        "analyze-bpm" \
        "yandex-cloud/functions/analyze-bpm" \
        "nodejs22" \
        "256" \
        "30"
    
    # Update function configuration
    echo -e "${YELLOW}⚙️  Updating function configuration...${NC}"
    yc serverless function set-access-bindings \
        --name="analyze-bpm" \
        --access-binding="serviceAccountId=$YANDEX_SERVICE_ACCOUNT_ID,role=serverless.functions.invoker"
    
    # Get function URL
    echo -e "${GREEN}🔗 Getting function URLs...${NC}"
    FUNCTIONS=("analyze-bpm")
    
    for func in "${FUNCTIONS[@]}"; do
        URL=$(yc serverless function get --name="$func" --format=json | jq -r '.http_invoke_url')
        echo -e "${BLUE}   $func:${NC} $URL"
    done
    
    # Update frontend config
    echo -e "${YELLOW}🔄 Updating frontend configuration...${NC}"
    if [ -n "$URL" ]; then
        sed -i.bak "s|https://functions.yandexcloud.net/d4ecmila416om4c1gh93|$URL|g" public/config.js
        echo -e "${GREEN}✅ Frontend config updated${NC}"
    fi
    
    # Deploy to Vercel
    echo -e "${YELLOW}🚀 Deploying frontend to Vercel...${NC}"
    if command -v vercel &> /dev/null; then
        vercel --prod
    else
        echo -e "${YELLOW}⚠️  Vercel CLI not found. Frontend deployment skipped.${NC}"
    fi
    
    echo -e "\n${GREEN}🎉 Deployment completed successfully!${NC}"
    echo -e "${BLUE}=====================================${NC}"
    echo -e "${GREEN}✅ Backend: Yandex Cloud Functions (Node.js 22)${NC}"
    echo -e "${GREEN}✅ Frontend: Vercel PWA${NC}"
    echo -e "${GREEN}✅ API: Ready for production use${NC}"
}

# Run main function
main "$@"
