/* ============================================================
   yk4r2 — shared chrome injector
   Builds the same top-nav + footer on every page so the site
   reads as one whole. Include with a data-base attribute that
   points back to the site root:
     root pages:        <script src="assets/site.js" data-base=""></script>
     /orthogonalization:<script src="../assets/site.js" data-base="../"></script>
   ============================================================ */
(function () {
  var script = document.currentScript;
  var base = (script && script.getAttribute('data-base')) || '';

  var LINKS = [
    { id: 'home',  label: 'Home',            href: 'index.html' },
    { id: 'prob',  label: 'Problems',        href: 'problems.html' },
    { id: 'lab',   label: 'Reversal Lab',    href: 'reversal_lab.html' },
    { id: 'math',  label: 'Reversal Math',   href: 'reversal_math.html' },
    { id: 'orth',  label: 'Orthogonalization', href: 'orthogonalization/index.html' }
  ];

  // figure out which link is current
  var path = location.pathname;
  var active = 'home';
  if (/problems\.html/.test(path)) active = 'prob';
  else if (/reversal_lab\.html/.test(path)) active = 'lab';
  else if (/reversal_math\.html/.test(path)) active = 'math';
  else if (/orthogonalization/.test(path)) active = 'orth';
  else if (/\/$|index\.html$/.test(path) || path === '' ) active = 'home';

  var logo = base + 'assets/icons/android-chrome-192x192.png';

  /* ---- nav ---- */
  var nav = document.createElement('nav');
  nav.className = 'site-nav';
  var linksHtml = LINKS.map(function (l) {
    var cur = l.id === active ? ' aria-current="page"' : '';
    return '<a href="' + base + l.href + '"' + cur + '>' + l.label + '</a>';
  }).join('');
  nav.innerHTML =
    '<div class="site-nav__inner">' +
      '<a class="site-brand" href="' + base + 'index.html">' +
        '<img src="' + logo + '" alt="yk4r2">' +
        '<b>yk4r2<span> / quant lab</span></b>' +
      '</a>' +
      '<div class="site-nav__links">' + linksHtml + '</div>' +
    '</div>';
  document.body.insertBefore(nav, document.body.firstChild);

  /* ---- footer ---- */
  if (!document.body.hasAttribute('data-no-footer')) {
    var footer = document.createElement('footer');
    footer.className = 'site-footer';
    var fLinks = LINKS.concat([
      { label: 'GitHub', href: 'https://github.com/yk4r2', ext: true }
    ]).map(function (l) {
      var href = l.ext ? l.href : base + l.href;
      var tgt = l.ext ? ' target="_blank" rel="noopener"' : '';
      return '<a href="' + href + '"' + tgt + '>' + l.label + '</a>';
    }).join('');
    footer.innerHTML =
      '<div class="site-footer__inner">' +
        '<div class="site-footer__brand">' +
          '<img src="' + logo + '" alt="yk4r2">' +
          '<div class="t"><b>yk4r2</b><br>quant research &amp; toy models</div>' +
        '</div>' +
        '<div class="site-footer__links">' + fLinks + '</div>' +
      '</div>';
    document.body.appendChild(footer);
  }
})();
