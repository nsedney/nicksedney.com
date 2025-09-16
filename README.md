# [nicksedney.com](http://nicksedney.com)

This is my website!

I'm currently hosted on aws - check out the `lib` package for [CDK](https://docs.aws.amazon.com/cdk/) stack definition that makes that happen.

## Setup/Architecture
As currently configured, the site can be found in `./website`; files are hosted in an s3 bucket, Route53 and CloudFront are configured to serve the static site for relevant domains.  All of this is managed via [CDK](https://docs.aws.amazon.com/cdk/) - check out the `bin` and `lib` directories to see how everything is put together.

### Deploying the site.
To deploy the site, `node` (recomend version 24) and the `aws-cli` must be installed.

#### Deploying from the CLI
To deploy, follow these steps:
* Authenticate with appropriate permissions to deploy to the account where domains are registered.  The recomended way to configure this is with an [IAM Identity Center](https://docs.aws.amazon.com/singlesignon/latest/userguide/what-is.html) user.  Use the following command, considering:
  * An `SSO start URL` will be requested - find this by logging into the AWS console with an appropriate account and navigating to the `IAM Identity Center`; look for the `AWS access portal URL`.
  * Use region `us-west-2`.
  * `default` is the default profile used by aws/cdk commands, recomended for ease-of-use.
```
aws configure sso --profile default
```

* Then to deploy changes to `website` or any updates to the CDK definition, run:
```
npm ci
npm run deploy
``` 

#### Deploying with Docker
A `Dockerfile` is provided that will build an image with all requisite dependencies (`aws-cli` and `node`).  To deploy with Docker:

* On a machine with the Docker daemon running, navigate to the project root and run:
```
docker build . -t nsedney-dev
docker run -it -v ./:/app --rm nsedney-dev
```
This should launch a shell from which site can be deployed.

* From the shell as follows, considering:
  * As above, requested `SSO start URL` can be found by navigating to the `IAM Identity Center` in the AWS console, listed as the `AWS access portal URL`; use region `us-west-2`.
  * `--use-device-code` is required as otherwise browser-based login will attempt to communicate with the aws-cli via a local port that's inaccesible on the running container.
```
aws configure sso --use-device-code --profile default
npm ci
npm run deploy
```
