#!/bin/sh
# Exhaustive execution probes: for every safe tool, every short flag -a..-z -A..-Z -0..-9 and every long
# option any platform documents, run it on THIS platform with and without an operand file and classify
# the answer by the tool's own rejection wording, learned from two canaries (-~ and --wiroam-no-such-option).
# Existence is then proven by execution, not by reading documentation.
#   sh collector/probe-all.sh <platform>   -> out/<platform>/_flagprobes.tsv
set -u
P="$1"
OUT="out/$P"
mkdir -p "$OUT"
TSV="$OUT/_flagprobes.tsv"
printf 'tool\tflag\tform\tcode\tclass\tstderr1\n' > "$TSV"

run_to() {
  if command -v timeout >/dev/null 2>&1; then timeout 5 "$@"
  elif command -v perl >/dev/null 2>&1; then perl -e 'alarm 5; exec @ARGV' -- "$@"
  else "$@"
  fi
}
first() { head -1 "$1" 2>/dev/null | tr '\t' ' ' | cut -c1-200; }

ROOT=$(pwd)
T=$(mktemp -d 2>/dev/null || mktemp -d -t wiroam)
LETTERS="a b c d e f g h i j k l m n o p q r s t u v w x y z A B C D E F G H I J K L M N O P Q R S T U V W X Y Z 0 1 2 3 4 5 6 7 8 9"

reset_dir() {
  cd "$T" && rm -rf ./* .[!.]* 2>/dev/null
  printf 'b\na\na\nc\n' > probe.txt
}

# Run one probe: $1 tool, $2 flag, $3 form (with|without). Prints "code<TAB>stderr1".
probe() {
  reset_dir
  if [ "$3" = with ]; then run_to "$1" "$2" probe.txt < /dev/null > /dev/null 2> "$T/.err"; c=$?
  else run_to "$1" "$2" < /dev/null > /dev/null 2> "$T/.err"; c=$?
  fi
  printf '%s\t%s' "$c" "$(first "$T/.err")"
}

n=0
while IFS= read -r tool; do
  case "$tool" in ''|'#'*) continue ;; esac
  command -v "$tool" >/dev/null 2>&1 || continue
  # Learn how this tool rejects an unknown short and long option; % stands for the option text.
  can1=$(probe "$tool" '-~' with | cut -f2); can1s=$(printf '%s' "$can1" | sed 's/~/%/')
  can2=$(probe "$tool" '--wiroam-no-such-option' with | cut -f2); can2s=$(printf '%s' "$can2" | sed 's/wiroam-no-such-option/%/')
  printf '%s\t%s\t%s\t%s\t%s\t%s\n' "$tool" '-~' canary '' canary "$can1" >> "$TSV"
  printf '%s\t%s\t%s\t%s\t%s\t%s\n' "$tool" '--wiroam-no-such-option' canary '' canary "$can2" >> "$TSV"
  for L in $LETTERS; do
    for form in with without; do
      r=$(probe "$tool" "-$L" "$form"); code=${r%%	*}; e=${r#*	}
      exp=$(printf '%s' "$can1s" | sed "s/%/$L/")
      if [ -n "$can1" ] && [ "$e" = "$exp" ]; then cls=rejected
      elif [ -n "$can1" ] && [ "$e" = "$can1" ] && [ "$can1" = "$can1s" ]; then cls=rejected   # generic usage line, no option echoed
      elif [ "$code" = 0 ]; then cls=accepted
      else cls=other
      fi
      printf '%s\t-%s\t%s\t%s\t%s\t%s\n' "$tool" "$L" "$form" "$code" "$cls" "$e" >> "$TSV"
      n=$((n+1))
    done
  done
  # Long options documented anywhere (collector/longopts.txt: tool<TAB>--option)
  grep "^$tool	" "$ROOT/collector/longopts.txt" 2>/dev/null | cut -f2 | while IFS= read -r lo; do
    for form in with without; do
      r=$(probe "$tool" "$lo" "$form"); code=${r%%	*}; e=${r#*	}
      name=${lo#--}
      exp=$(printf '%s' "$can2s" | sed "s/%/$name/")
      if [ -n "$can2" ] && [ "$e" = "$exp" ]; then cls=rejected
      elif [ -n "$can2" ] && [ "$e" = "$can2" ] && [ "$can2" = "$can2s" ]; then cls=rejected
      elif [ "$code" = 0 ]; then cls=accepted
      else cls=other
      fi
      printf '%s\t%s\t%s\t%s\t%s\t%s\n' "$tool" "$lo" "$form" "$code" "$cls" "$e" >> "$TSV"
    done
  done
done < "$ROOT/collector/probe-tools.txt"
cd "$ROOT"
rm -rf "$T"
echo "flag probes on $P: $(($(wc -l < "$TSV") - 1)) rows"
