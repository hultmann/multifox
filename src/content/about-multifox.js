/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */


"use strict";

var Cc = Components.classes;
var Ci = Components.interfaces;

window.addEventListener("DOMContentLoaded", function() {
  loadBadges();
  populateDescription();
  populatePage();
}, false);


// load badges document into file:// iframe
function loadBadges() {
  Components.utils.import("resource://gre/modules/Services.jsm");
  var uri = Services.io.newURI("${PATH_CONTENT}/about-badges.html", null, null);

  var fileUrl = Cc["@mozilla.org/chrome/chrome-registry;1"]
                .getService(Ci.nsIChromeRegistry)
                .convertChromeURL(uri)
                .spec;

  var iframe = document.getElementById("badges");
  iframe.setAttribute("src", fileUrl);
  iframe.contentWindow.addEventListener("load", function() {
    // about:blank loaded
    iframe.setAttribute("src", fileUrl);
  }, false);
}


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

  var items = ["spread", "author", "l10n", "source", "legal", "version2"];
  for (var idx = items.length - 1; idx > -1; idx--) {
    var id = items[idx];
    var hHtml = ns.util.getTextFrom(id + ".h", "about");
    var pId = id + ".p";
    var pHtml;
    switch (id) {
      case "spread":
        hHtml = ns.util.getTextFrom(id + ".h", "about");
        pHtml = "<!-- nop -->";
        break;

      case "author":
        pHtml = ns.util.getTextFrom(pId, "about", "mailto:hultmann@gmail.com",
                                                  "http://twitter.com/multifox",
                                                  "https://github.com/hultmann/multifox/issues");
        break;

      case "version2":
        pHtml = ns.util.getTextFrom(pId, "about", "http://br.mozdev.org/multifox/all.html");
        break;

      case "source":
        pHtml = ns.util.getTextFrom(pId, "about", "${EXT_NAME}", "${SOURCE_URL}");
        break;

      case "l10n":
        var reg = Cc["@mozilla.org/chrome/chrome-registry;1"]
                    .getService(Ci.nsIXULChromeRegistry);
        var localeApp = reg.getSelectedLocale("global");
        var localeExt = reg.getSelectedLocale("${CHROME_NAME}");

        hHtml = ns.util.getTextFrom(id + ".h", "about", localeExt);

        if (hasExtensionLocale(localeApp)) {
          pHtml = ns.util.getTextFrom(pId, "about").trim();
        } else {
          pHtml = 'Multifox is not yet available in your language (<b>' + localeApp + '</b>). <a href="http://br.mozdev.org/multifox/l10n.html">Please join BabelZilla if you are interested in localizing it!</a>';
        }
        break;

      default:
        pHtml = ns.util.getTextFrom(pId, "about");
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
                  .getLocalesForPackage("${CHROME_NAME}");
  while (locales.hasMore()) {
    if (locales.getNext() === code) {
      return true;
    }
  }
  return false;
}
