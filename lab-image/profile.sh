# Generado por el laboratorio en cada arranque -- no lo edites aqui.
# Para tus propios ajustes usa ~/.bashrc.local (se conserva entre clases).

export STUDENT="${STUDENT:-aprendiz}"
export HISTFILE="$HOME/.bash_history"
export HISTSIZE=2000
export HISTFILESIZE=2000

export PS1='\[\e[36m\]\u@lab-'"${STUDENT}"'\[\e[0m\]:\[\e[34m\]\w\[\e[0m\]\$ '

alias ll='ls -la'
alias la='ls -A'
alias dc='docker compose'
alias dps='docker ps'
alias dimg='docker images'

if [ -t 0 ]; then
  cat <<BANNER

🐳 Laboratorio Docker-in-Docker — ${STUDENT}
   Tema de hoy: ${LAB_MOTD:-(sin tema configurado)}
   Tu carpeta /workspace es persistente: lo que guardes ahi sigue la proxima clase.
   Ya tienes imagenes precargadas -- revisa con: docker images

BANNER
fi

[ -f "$HOME/.bashrc.local" ] && . "$HOME/.bashrc.local"
