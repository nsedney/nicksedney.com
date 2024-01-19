import * as cdk from 'aws-cdk-lib';
import * as acm from 'aws-cdk-lib/aws-certificatemanager';
import { Construct } from 'constructs';

/*
Stack explicitely for creating certificates.

For certain resources to work (at least CloudFront), we must create our certs in region `us-east-1`; given
we're operatin in a different region a separate stack is needed:
https://docs.aws.amazon.com/cdk/api/v2/docs/aws-cdk-lib.aws_certificatemanager-readme.html#cross-region-certificates 
*/
export class NicksedneyCertStack extends cdk.Stack {
    public readonly nickSedneyCert: acm.Certificate;

    constructor(scope: Construct, id: string, props?: cdk.StackProps) {
        super(scope, id, { ...props });

        this.nickSedneyCert = new acm.Certificate(this, 'nicksedneyCertificate', {
            domainName: 'nicksedney.com',
            subjectAlternativeNames: ['*.nicksedney.com'],
            certificateName: 'Nick Sedney Homepage',
            validation: acm.CertificateValidation.fromDns()
        });
    }
}