FROM rust:1-buster

RUN apt-get update && \
    apt-get install -y python3-pip qrencode && \
    apt-get clean && \
    pip3 install python-vipaccess

WORKDIR /workspace

COPY Cargo.lock Cargo.toml ./
COPY src/ src/

RUN cargo build --release

COPY public/ public/
COPY templates/ templates/
COPY .env ./

CMD cargo run --release
