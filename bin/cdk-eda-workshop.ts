#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { EdaWSNetworkStack, EdaWSSqsStack, EdaWSSnsStack } from '../lib/stack-1-infra';
import { EdaWSEcsStack } from '../lib/stack-2-ecs';

const app = new cdk.App();
const networkStack = new EdaWSNetworkStack(app, 'stack-1-infra', {
  env: { 
    account: process.env.CDK_DEFAULT_ACCOUNT, 
    region: process.env.CDK_DEFAULT_REGION
  },
});

new EdaWSEcsStack(app, 'stack-2-ecs', {
  vpc: networkStack.vpc,
  repository: networkStack.repository,
  databaseCluster: networkStack.databaseCluster,
  env: { 
    account: process.env.CDK_DEFAULT_ACCOUNT, 
    region: process.env.CDK_DEFAULT_REGION
  },
});

new EdaWSSqsStack(app, 'stack-sqs', {
  env: {
    account: process.env.CDK_DEFAULT_ACCOUNT, 
    region: process.env.CDK_DEFAULT_REGION
  },
});

new EdaWSSnsStack(app, 'stack-sns', {
  env: {
    account: process.env.CDK_DEFAULT_ACCOUNT, 
    region: process.env.CDK_DEFAULT_REGION
  },
});