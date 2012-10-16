/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

"use strict";

var Cc = Components.classes;
var Ci = Components.interfaces;
var Cu = Components.utils;

window.addEventListener("DOMContentLoaded", function() {
  loadBadges();
  populateDescription();
  populatePage();
}, false);


// load badges document into file:// iframe
function loadBadges() {
  Cu.import("resource://gre/modules/Services.jsm");
  var uri = Services.io.newURI("${PATH_CONTENT}/about-badges.html", "UTF-8", null);

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
  Cu.import("resource://gre/modules/AddonManager.jsm", jsm);
  jsm.AddonManager.getAddonByID("${EXT_ID}", function(addon) {
    document.getElementById("desc").innerHTML = addon.description;
  });
}


function populatePage() {
  var ns = {};
  Cu.import("${PATH_MODULE}/main.js", ns);

  var items = ["spread", "author", "l10n", "source", "legal"];
  for (var idx = items.length - 1; idx > -1; idx--) {
    var id = items[idx];
    var hHtml = ns.util.getTextFrom("about.properties", id + ".h");
    var pId = id + ".p";
    var pHtml;
    switch (id) {
      case "spread":
        hHtml = ns.util.getTextFrom("about.properties", id + ".h");
        pHtml = "<!-- nop -->";
        break;

      case "author":
        pHtml = ns.util.getTextFrom("about.properties",
                                    pId,
                                    "mailto:hultmann@gmail.com",
                                    "http://twitter.com/multifox",
                                    "https://github.com/hultmann/multifox/issues");
        break;
/*
      case "version1":
        pHtml = ns.util.getTextFrom("about.properties", Id, "http://br.mozdev.org/multifox/all.html");
        break;
*/
      case "source":
        pHtml = ns.util.getTextFrom("about.properties", pId, "${EXT_NAME}", "https://github.com/hultmann/multifox/tree/${EXT_VERSION}");
        break;

      case "l10n":
        var reg = Cc["@mozilla.org/chrome/chrome-registry;1"].getService(Ci.nsIXULChromeRegistry);
        var localeApp = reg.getSelectedLocale("global");
        var localeExt = reg.getSelectedLocale("${CHROME_NAME}");

        hHtml = ns.util.getTextFrom("about.properties", id + ".h", localeExt);

        if (hasExtensionLocale(localeApp)) {
          pHtml = ns.util.getTextFrom("about.properties", pId).trim();
        } else {
          pHtml = 'Multifox is not yet available in your language (<b>' + localeApp + '</b>). <a href="http://br.mozdev.org/multifox/l10n.html?v=${EXT_VERSION}">Please join BabelZilla if you are interested in localizing it!</a>';
        }
        break;

      default:
        pHtml = ns.util.getTextFrom("about.properties", pId);
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
