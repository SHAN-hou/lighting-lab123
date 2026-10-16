#!/usr/bin/env bash
# 用无头 Edge 跑 .gt/*.png 的完整分析流程（需先用 VITE_TEST_KEY 启动 5174 端口的开发服务器）
# 用法：bash scripts/autotest.sh rembrandt split ...
EDGE="/c/Program Files (x86)/Microsoft/Edge/Application/msedge.exe"
for name in "$@"; do
  T=$(mktemp -d)
  "$EDGE" --headless=new --user-data-dir="$T" --use-angle=swiftshader --enable-unsafe-swiftshader \
    --enable-logging=stderr --v=0 --hide-scrollbars --window-size=1600,1000 --virtual-time-budget=180000 \
    --screenshot="$PWD/.gt/out-$name.png" "http://localhost:5174/?nohelp&autotest=$name" 2>".gt/log-$name.txt" >/dev/null
  rm -rf "$T"
  line=$(grep -o 'AUTOTEST {.*}' ".gt/log-$name.txt" | head -1 | sed 's/^AUTOTEST //')
  node -e '
    const name = process.argv[1], s = process.argv[2];
    if (!s) { console.log(name, "：没有结果（超时或出错）"); process.exit(); }
    const j = JSON.parse(s), f = (l) => l.on ? `az ${l.az} 仰角 ${Math.round(Math.atan2(l.height - 1.6, l.dist) * 180 / Math.PI)}° ${l.mod} ${l.power}%${l.target === "bg" ? " 照背景" : ""}${l.rgb ? " RGB " + l.hue : ""}` : "关";
    const p = j.px || {}, r = (v) => (v == null ? "-" : (+v).toFixed(2));
    console.log(`${name}  [实测 左右 ${r(p.sideStops)} 背景 ${r(p.bgStops)} 眼窝 ${r(p.eyeStops)} 黑白 ${p.bw}]\n  主灯 ${f(j.lights.key)}\n  辅灯 ${f(j.lights.fill)}\n  轮廓 ${f(j.lights.rim)}\n  背景 ${j.bg.color} ${j.bg.dist}m${j.status ? "\n  状态 " + j.status : ""}\n  ${j.notes.join("\n  ")}`);
  ' "$name" "$line"
done
