#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { NicksedneyComStack } from '../lib/nicksedney.com-stack';
import { NicksedneyCertStack } from '../lib/nicksedneycertstack';

const app = new cdk.App();

// We need to create our HTTPS cert in a separate stack as it needs to exist in `us-east-1` region:
// https://docs.aws.amazon.com/cdk/api/v2/docs/aws-cdk-lib.aws_certificatemanager-readme.html#cross-region-certificates 
const certStack = new NicksedneyCertStack(app, 'NicksedneyCertStack', {
  env: {
    account: process.env.CDK_DEFAULT_ACCOUNT, // We appear to need to explicitly provide `account` for multi-stack deployment
    region: "us-east-1", // TODO: Are there defined types we could/should use?  What's ts convention for constants?
  },
  crossRegionReferences: true,
});

new NicksedneyComStack(app, 'NicksedneyComStack', {
  env: {
    account: process.env.CDK_DEFAULT_ACCOUNT, 
    region: process.env.CDK_DEFAULT_REGION },
  nicksedneyCert: certStack.nickSedneyCert,
  crossRegionReferences: true,
}).addDependency(certStack);
