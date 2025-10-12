# Defines a container with dependencies necessary to deploy the website to AWS.

# Use the official aws-cli image (built on Amazon Linux 2023) as the base image;
# aws-cli is a pain to install otherwise, and nvm/node can be installed idiomatically.
FROM amazon/aws-cli:2.30.2

ENV NODE_VERSION=22.16.0
ENV NVM_VERSION=0.40.3

# Install nvm (and requisite dependencies)
RUN yum install tar gzip -y
RUN curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v${NVM_VERSION}/install.sh | bash
ENV NVM_DIR="/root/.nvm"

# Install specified node version and add to PATH
RUN . "$NVM_DIR/nvm.sh" && nvm install ${NODE_VERSION}
ENV PATH="/root/.nvm/versions/node/v${NODE_VERSION}/bin/:${PATH}"

WORKDIR /app

# Override the base image entrypoint, as we currently need to run a few shell commands to do configure/use the cdk cli.
ENTRYPOINT [ "bash" ]

# TODO: This is still a POC - consider ways to further streamline dev/deployment process:
#   * Resultant image could be registered to ensure reproducibility
#   * A single docker command could run entire deployment w/out shell interaction, though minimizing AWS auth friction is a challenge.
#   * W/ dev containers this may not be needed at all, though a solution w/out the VSCode dependency would be nice.
