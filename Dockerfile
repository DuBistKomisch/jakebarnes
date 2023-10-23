FROM rust:1-buster

RUN apt-get update && \
    apt-get install -y python3-pip qrencode && \
    apt-get clean && \
    pip3 install python-vipaccess

WORKDIR /workspace

# dummy build to cache deps
RUN USER=root cargo init
COPY Cargo.lock Cargo.toml ./
RUN cargo build --release

# real build
COPY src/ src/
RUN touch src/main.rs && cargo build --release

COPY public/ public/
COPY templates/ templates/
COPY .env ./

CMD cargo run --release
