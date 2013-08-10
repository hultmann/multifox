/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */


"use strict";

var Cc = Components.classes;
var Ci = Components.interfaces;

window.addEventListener("DOMContentLoaded", function() {
  populateDescription();
  populatePage();
}, false);


function populateDescription() {
  var jsm = {};
  Components.utils.import("resource://gre/modules/AddonManager.jsm", jsm);
  jsm.AddonManager.getAddonByID("${EXT_ID}", function(addon) {
    document.getElementById("desc").innerHTML = addon.description;
  });
}


function populatePage() {
  var ns = {};
  Components.utils.import("${PATH_MODULE}/new-window.js", ns);

  var items = ["author", "l10n", "source", "legal"];
  for (var idx = items.length - 1; idx > -1; idx--) {
    var id = items[idx];
    var hHtml = ns.util.getTextFrom(id + ".h", "about-multifox");
    var pId = id + ".p";
    var pHtml;
    switch (id) {
      case "author":
        pHtml = ns.util.getTextFrom(pId, "about-multifox",
                                    "https://github.com/hultmann/multifox/issues",
                                    "https://twitter.com/multifox",
                                    "mailto:hultmann@gmail.com");
        break;

      case "source":
        pHtml = ns.util.getTextFrom(pId, "about-multifox", "${EXT_NAME}", "${SOURCE_URL}");
        break;

      case "l10n":
        var reg = Cc["@mozilla.org/chrome/chrome-registry;1"]
                    .getService(Ci.nsIXULChromeRegistry);
        var localeApp = reg.getSelectedLocale("global");
        var localeExt = reg.getSelectedLocale("${EXT_HOST}");

        hHtml = ns.util.getTextFrom(id + ".h", "about-multifox", localeExt);

        if (hasExtensionLocale(localeApp)) {
          pHtml = ns.util.getTextFrom(pId, "about-multifox").trim();
        } else {
          pHtml = 'Multifox is not yet available in your language (<b>' + localeApp + '</b>). <a href="http://br.mozdev.org/multifox/l10n.html">Please join BabelZilla if you are interested in localizing it!</a>';
        }
        break;

      default:
        pHtml = ns.util.getTextFrom(pId, "about-multifox");
        break;
    }
    if (pHtml.length > 0) {
      document.getElementById(id + "-h").innerHTML = hHtml;
      document.getElementById(id + "-p").innerHTML = pHtml;
    }
  }
}


function hasExtensionLocale(code) {
  var locales = Cc["@mozilla.org/chrome/chrome-registry;1"]
                  .getService(Ci.nsIToolkitChromeRegistry)
                  .getLocalesForPackage("${EXT_HOST}");
  while (locales.hasMore()) {
    if (locales.getNext() === code) {
      return true;
    }
  }
  return false;
}
