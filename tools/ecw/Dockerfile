FROM ubuntu:22.04
ARG DEBIAN_FRONTEND=noninteractive
RUN apt-get update && apt-get install -y --no-install-recommends \
      g++ build-essential autoconf automake m4 libtool make unzip wget patch ca-certificates \
 && rm -rf /var/lib/apt/lists/*
WORKDIR /build
RUN wget -q https://github.com/bogind/libecwj2-3.3/raw/master/libecwj2-3.3-2006-09-06.zip \
 && unzip -q libecwj2-3.3-2006-09-06.zip \
 && cd libecwj2-3.3 \
 && ./configure --prefix=/usr/local \
 && make -j2 \
 && make install \
 && ldconfig
COPY ecwdump.c /build/ecwdump.c
RUN g++ -O2 -o /usr/local/bin/ecwdump /build/ecwdump.c \
      -I/usr/local/include -L/usr/local/lib -lNCSEcw -lNCSCnet -lNCSUtil -lpthread \
 && ldconfig
WORKDIR /data
ENTRYPOINT ["ecwdump"]
