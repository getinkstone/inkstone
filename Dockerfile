FROM thyrlian/android-sdk:6.1

ENV DEBIAN_FRONTEND=noninteractive
ENV CORDOVA_ANDROID_GRADLE_DISTRIBUTION_URL=https://services.gradle.org/distributions/gradle-2.2.1-all.zip

RUN apt-get update && apt-get install nodejs curl -y && apt-get clean

RUN curl https://install.meteor.com/ | sh

# FIXME: probably not everything listed here is needed.
RUN /opt/android-sdk/cmdline-tools/tools/bin/sdkmanager \
    "build-tools;28.0.3"\
    "emulator"\
    "extras;android;m2repository"\
    "extras;google;m2repository"\
    "extras;m2repository;com;android;support;constraint;constraint-layout-solver;1.0.2"\
    "extras;m2repository;com;android;support;constraint;constraint-layout;1.0.2"\
    "patcher;v4"\
    "platform-tools"\
    "platforms;android-14"\
    "platforms;android-23"\
    "platforms;android-28"\
    "sources;android-23" \
    >/dev/null

# workaround: new versions of Android tools don't build our setup
RUN cd /opt/android-sdk && \
    rm -rf tools && \
    curl -O https://dl.google.com/android/repository/tools_r25.2.3-linux.zip && \
    unzip -qq tools_r25.2.3-linux.zip && \
    rm tools_r25.2.3-linux.zip && \
    chown 1000:1000 tools -R

USER 1000
RUN mkdir /tmp/project

ADD --chown=1000:1000 client /tmp/project/client
ADD --chown=1000:1000 cordova-build-override /tmp/project/cordova-build-override
ADD --chown=1000:1000 lib /tmp/project/lib
ADD --chown=1000:1000 mobile-config.js /tmp/project/mobile-config.js
ADD --chown=1000:1000 public /tmp/project/public
ADD --chown=1000:1000 scripts /tmp/project/scripts
ADD --chown=1000:1000 server /tmp/project/server
ADD --chown=1000:1000 .meteor /tmp/project/.meteor

WORKDIR /tmp/project
ENV HOME=/tmp

ENV ANDROID_HOME=/opt/android-sdk
ENV PATH=$PATH:/opt/android-sdk/tools/

RUN meteor build .build --server localhost:3785 --allow-superuser
RUN cp -R cordova-build-override/* .build/android/project/assets/.
RUN cd .build/android/project/cordova ; ./build --release

# Restore Ubuntu's entrypoint that was changed by the base image:
ENTRYPOINT /bin/bash
