# UI for live preview 
cd gui
npm run dev


# Script for injecting in websites
cd tracking-script
npm run build --silent 

# serve it on host (live updates)
cd /Users/yogeshsharma/Projects/ux-guru/tracking-script/dist
python3 -m http.server 4500 --bind 127.0.0.1

# use on website
javascript:(function(){
  var s=document.createElement('script');
  s.src='http://127.0.0.1:4500/tracker.js';
  document.head.appendChild(s);
})();


# Websocket for communication
cd ws-event-server
npm run dev


# Test open demo.html (with vs code live server extension) and localhost:5173
