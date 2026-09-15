FROM docker:27-dind

# ttyd + utilidades minimas para que el aprendiz no dependa de internet para lo basico.
# git, compose y buildx ya vienen heredados de docker:27-cli.
RUN apk add --no-cache \
    ttyd bash curl nano vim jq less tree htop bash-completion ncurses

COPY entrypoint.sh /entrypoint.sh
COPY healthcheck.sh /healthcheck.sh
COPY profile.sh /etc/skel/.bashrc
COPY seed/ /seed/

RUN chmod +x /entrypoint.sh /healthcheck.sh

# El healthcheck es lo que le permite al orquestador distinguir "iniciando" de
# "activo": dockerd tarda unos segundos en levantar dentro del contenedor.
HEALTHCHECK --interval=5s --timeout=3s --start-period=45s --retries=8 \
  CMD ["/healthcheck.sh"]

ENTRYPOINT ["/entrypoint.sh"]
