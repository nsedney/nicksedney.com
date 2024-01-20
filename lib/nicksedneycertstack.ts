import * as cdk from 'aws-cdk-lib';
import * as acm from 'aws-cdk-lib/aws-certificatemanager';
import * as route53 from 'aws-cdk-lib/aws-route53';
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
            subjectAlternativeNames: [
                // All domain names specified here must have a HostedZone provided in validation config below; otherwise deployment will hang
                // until CNAME record is added manually:
                // https://docs.aws.amazon.com/cdk/api/v2/docs/aws-cdk-lib.aws_certificatemanager-readme.html#dns-validation
                '*.nicksedney.com', 'nicholassedney.com', '*.nicholassedney.com', 'nsedney.com', '*.nsedney.com'
            ],
            certificateName: 'Nick Sedney Homepage',
            // In order for ACM to validate the certificate we're creating, it must create CNAME records in corresponding 'HostedZone' for
            // each domain name.  We must explicitly provide these HostedZones in order for that to work.
            // NOTE:
            //   The HostedZones should be auto-generated when registering domain names with Route53, and should NOT be created by CDK.
            //   If we try to create in CDK we'll get random name servers that don't match registered domain:
            //   https://docs.aws.amazon.com/Route53/latest/DeveloperGuide/domain-replace-hosted-zone.html
            // TODO: We're also looking these up as part of main stack config.  Try to re-organize this to be a bit cleaner ...
            validation: acm.CertificateValidation.fromDnsMultiZone({
                "nicksedney.com": route53.HostedZone.fromLookup(this, "nicksedneyzone", { domainName: "nicksedney.com" }),
                "nsedney.com": route53.HostedZone.fromLookup(this, "nsedneyzone", { domainName: "nsedney.com" }),
                "nicholassedney.com": route53.HostedZone.fromLookup(this, "nicholassedneyzone", { domainName: "nicholassedney.com" })
            })
        });
    }
}