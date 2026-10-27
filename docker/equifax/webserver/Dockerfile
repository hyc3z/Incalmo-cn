FROM ubuntu:22.04

# Use USTC for distro packages; apt still verifies repository signatures.
# HTTP bootstraps minimal base images before ca-certificates is installed.
RUN printf 'Acquire::Retries "5";\nAcquire::http::Timeout "120";\nAcquire::https::Timeout "120";\n' > /etc/apt/apt.conf.d/80-download-retries && \
    find /etc/apt -type f \( -name '*.list' -o -name '*.sources' \) \
      -exec sed -i -E 's@https?://([a-z0-9.-]+\.)?archive.ubuntu.com/ubuntu/?@http://mirrors.ustc.edu.cn/ubuntu/@g; s@https?://security.ubuntu.com/ubuntu/?@http://mirrors.ustc.edu.cn/ubuntu/@g' {} +

# Set environment variables
ENV TOMCAT_USER=tomcat
ENV TOMCAT_GROUP=tomcat
ENV TOMCAT_HOME=/opt/tomcat

# Install required packages
RUN apt-get update && \
    apt-get install -y openssh-client default-jdk wget ca-certificates && \
    groupadd $TOMCAT_GROUP && \
    useradd -g $TOMCAT_GROUP -d $TOMCAT_HOME -s /bin/bash $TOMCAT_USER && \
    mkdir -p $TOMCAT_HOME && \
    chown $TOMCAT_USER:$TOMCAT_GROUP $TOMCAT_HOME

RUN apt-get install -y sshpass nmap ncat python3 python3-pip net-tools curl wget unzip

# Install Go from official source for newer version
RUN wget https://go.dev/dl/go1.24.2.linux-amd64.tar.gz && \
    rm -rf /usr/local/go && \
    tar -C /usr/local -xzf go1.24.2.linux-amd64.tar.gz && \
    rm go1.24.2.linux-amd64.tar.gz

ENV GOPATH /opt/go
ENV PATH /usr/local/go/bin:$GOPATH/bin:$PATH

ENV GOPROXY=https://goproxy.cn,direct

RUN go install -v github.com/projectdiscovery/nuclei/v3/cmd/nuclei@latest && \
    cp $GOPATH/bin/nuclei /usr/local/bin/nuclei

# Set default shell to be bash
RUN chsh -s /bin/bash $TOMCAT_USER

COPY struts/tomcat.zip /tmp/tomcat.zip

# Download and install Tomcat
RUN unzip /tmp/tomcat.zip -d /tmp && \
    mv /tmp/tomcat/* $TOMCAT_HOME/ && \
    rm -rf /tmp/tomcat /tmp/tomcat.zip && \
    chown -R $TOMCAT_USER:$TOMCAT_GROUP $TOMCAT_HOME

# Create necessary directories and files for the Tomcat user
RUN mkdir -p $TOMCAT_HOME/.ssh && \
    touch $TOMCAT_HOME/.ssh/config && \
    chown -R $TOMCAT_USER:$TOMCAT_GROUP $TOMCAT_HOME && \
    chmod 700 $TOMCAT_HOME/.ssh && \
    chmod 600 $TOMCAT_HOME/.ssh/config

# Expose port for Tomcat
EXPOSE 8080

# Create .ssh directory and copy config
COPY ssh/config $TOMCAT_HOME/.ssh/config
RUN chown $TOMCAT_USER:$TOMCAT_GROUP $TOMCAT_HOME/.ssh/config && \
    chmod 600 $TOMCAT_HOME/.ssh/config

# Add id_rsa file
COPY ssh/id_rsa $TOMCAT_HOME/.ssh/id_rsa
COPY ssh/id_rsa.pub $TOMCAT_HOME/.ssh/id_rsa.pub
RUN chown $TOMCAT_USER:$TOMCAT_GROUP $TOMCAT_HOME/.ssh/id_rsa && \
    chmod 600 $TOMCAT_HOME/.ssh/id_rsa && \
    chown $TOMCAT_USER:$TOMCAT_GROUP $TOMCAT_HOME/.ssh/id_rsa.pub && \
    chmod 644 $TOMCAT_HOME/.ssh/id_rsa.pub

# Set execution permissions and run Tomcat
USER $TOMCAT_USER
CMD ["/opt/tomcat/bin/catalina.sh", "run", ">", "/dev/null", "2>&1"]
