/* free pattern signup: leave an email, get the pdf.
   KIT_FORM set in build.py -> the email goes to Kit. empty -> it goes to the old newsletter Google Form.
   Static site, so it's an honor system. Once someone signs up, this browser skips the form next time. */
(function () {
  var g = document.querySelector(".pgate");
  if (!g) return;
  var cfg = {};
  try { cfg = JSON.parse(g.dataset.cfg || "{}"); } catch (_) {}
  var form = g.querySelector(".pgate-form"), files = g.querySelector(".pgate-files"), err = g.querySelector(".pgate-err");
  var KEY = "sos_patterns_in";

  function open(first) {
    form.hidden = true;
    files.hidden = false;
    if (!first) { var t = files.querySelector(".pgate-thanks"); if (t) t.textContent = "Welcome back. Here it is."; }
  }
  try { if (localStorage.getItem(KEY)) return open(false); } catch (_) {}

  function send(email) {
    var body = new URLSearchParams();
    var url;
    if (cfg.kit) {
      url = "https://app.kit.com/forms/" + encodeURIComponent(cfg.kit) + "/subscriptions";
      body.append("email_address", email);    } else {
      url = cfg.gform;
      var f = cfg.f || {};
      body.append(f.email, email);
      body.append(f.ok, "Yes");
      body.append(f.about, "The Latest Beading Patterns");
    }
    // no-cors: neither service answers in a way the page can read, so we don't wait on it
    try { return fetch(url, { method: "POST", mode: "no-cors", body: body }).catch(function () {}); } catch (_) { return Promise.resolve(); }
  }

  form.addEventListener("submit", function (ev) {
    ev.preventDefault();
    var email = (form.email.value || "").trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) { err.hidden = false; form.email.focus(); return; }
    err.hidden = true;
    var btn = form.querySelector("button");
    btn.disabled = true;
    send(email);
    try { localStorage.setItem(KEY, "1"); } catch (_) {}
    open(true);
    var a = files.querySelector("a"); if (a) a.focus();
  });
})();
