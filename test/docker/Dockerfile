# Dockerfile for testing universal-nvm installation and usage on Linux
# This simulates the real user installation flow on a clean system
FROM ubuntu:22.04

# Prevent interactive prompts during package installation
ENV DEBIAN_FRONTEND=noninteractive

# Install only basic prerequisites (what users typically have)
RUN apt-get update && apt-get install -y \
    curl \
    bash \
    zsh \
    tar \
    ca-certificates \
    wget \
    libicu70 \
    && update-ca-certificates \
    && rm -rf /var/lib/apt/lists/*

# Install PowerShell 7 from tarball (works better in containers)
# Detect architecture and download the appropriate build
RUN ARCH=$(uname -m) \
    && if [ "$ARCH" = "x86_64" ]; then PWSH_ARCH="x64"; \
       elif [ "$ARCH" = "aarch64" ]; then PWSH_ARCH="arm64"; \
       else echo "Unsupported architecture: $ARCH" && exit 1; fi \
    && wget -q https://github.com/PowerShell/PowerShell/releases/download/v7.4.1/powershell-7.4.1-linux-${PWSH_ARCH}.tar.gz -O /tmp/powershell.tar.gz \
    && mkdir -p /opt/microsoft/powershell/7 \
    && tar -xzf /tmp/powershell.tar.gz -C /opt/microsoft/powershell/7 \
    && chmod +x /opt/microsoft/powershell/7/pwsh \
    && ln -s /opt/microsoft/powershell/7/pwsh /usr/bin/pwsh \
    && rm /tmp/powershell.tar.gz

# Create a test user (simulate real user environment)
RUN useradd -m -s /bin/bash testuser

# Switch to test user
USER testuser
WORKDIR /home/testuser

# Copy the packed tarball and install scripts
# These will be served via HTTP to simulate real download
COPY --chown=testuser:testuser universal-nvm-*.tgz /tmp/universal-nvm-local.tgz
COPY --chown=testuser:testuser install.sh /tmp/install.sh
COPY --chown=testuser:testuser test/docker/test.sh /tmp/test.sh

# Copy test script
COPY --chown=testuser:testuser test/docker/test-install.sh /home/testuser/test-install.sh
COPY --chown=testuser:testuser test/docker/run-install.sh /home/testuser/run-install.sh
RUN chmod +x /home/testuser/test-install.sh /home/testuser/run-install.sh

# Run installation and tests by default
CMD ["/bin/bash", "-c", "./run-install.sh"]
