FROM kalilinux/kali-last-release

# Use USTC for distro packages; apt still verifies repository signatures.
# HTTP bootstraps minimal base images before ca-certificates is installed.
RUN printf 'Acquire::Retries "5";\nAcquire::http::Timeout "120";\nAcquire::https::Timeout "120";\n' > /etc/apt/apt.conf.d/80-download-retries && \
    find /etc/apt -type f \( -name '*.list' -o -name '*.sources' \) \
      -exec sed -i -E 's@https?://http.kali.org/kali/?@http://mirrors.ustc.edu.cn/kali/@g; s@https?://kali.download/kali/?@http://mirrors.ustc.edu.cn/kali/@g' {} +

RUN apt-get update && apt-get install -y python3 python3-pip ca-certificates
RUN apt-get install -y nmap net-tools golang-go curl wget sshpass procps nikto

ENV GOPROXY=https://goproxy.cn,direct

RUN go install -v github.com/projectdiscovery/nuclei/v3/cmd/nuclei@latest
ENV GOPATH /root/go
ENV PATH $GOPATH/bin:$PATH

# Install Metasploit dependencies
RUN curl https://raw.githubusercontent.com/rapid7/metasploit-omnibus/master/config/templates/metasploit-framework-wrappers/msfupdate.erb > msfinstall && \
  chmod 755 msfinstall && \
  ./msfinstall

# Retry the full install when a wheel download is interrupted.
RUN for attempt in 1 2 3 4 5; do \
      pip install --break-system-packages --index-url https://mirrors.ustc.edu.cn/pypi/simple --timeout 120 --retries 10 uv && break; \
      if [ "$attempt" -eq 5 ]; then exit 1; fi; \
      sleep 5; \
    done

# Create ssh directory and server directory
RUN mkdir -p /root/.ssh
RUN mkdir -p /server

# Create ssh key
RUN ssh-keygen -b 2048 -t rsa -f '/root/.ssh/id_rsa' -q -N ""

# Set key permissions
RUN chmod 600 /root/.ssh/id_rsa
RUN chmod 700 /root/.ssh

# Copy attacker files
COPY ./ /incalmo
COPY ./incalmo/c2server/agents /agents
WORKDIR /incalmo

# Allow slower mirror connections during build and runtime.
ENV UV_HTTP_TIMEOUT=120 UV_HTTP_RETRIES=5

# Install dependencies using the project's USTC index.
RUN uv sync

ENV PYTHONUNBUFFERED=1
ENV PYTHONPATH=/incalmo

# Run the startup script
CMD ["bash", "./docker/attacker/start.sh"]