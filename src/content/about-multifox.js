/* ***** BEGIN LICENSE BLOCK *****
 * Version: MPL 1.1/GPL 2.0/LGPL 2.1
 *
 * The contents of this file are subject to the Mozilla Public License Version
 * 1.1 (the "License"); you may not use this file except in compliance with
 * the License. You may obtain a copy of the License at
 * http://www.mozilla.org/MPL/
 *
 * Software distributed under the License is distributed on an "AS IS" basis,
 * WITHOUT WARRANTY OF ANY KIND, either express or implied. See the License
 * for the specific language governing rights and limitations under the
 * License.
 *
 * The Original Code is Multifox.
 *
 * The Initial Developer of the Original Code is
 * Jeferson Hultmann <hultmann@gmail.com>
 * Portions created by the Initial Developer are Copyright (C) 2010
 * the Initial Developer. All Rights Reserved.
 *
 * Contributor(s):
 *
 * Alternatively, the contents of this file may be used under the terms of
 * either the GNU General Public License Version 2 or later (the "GPL"), or
 * the GNU Lesser General Public License Version 2.1 or later (the "LGPL"),
 * in which case the provisions of the GPL or the LGPL are applicable instead
 * of those above. If you wish to allow use of your version of this file only
 * under the terms of either the GPL or the LGPL, and not to allow others to
 * use your version of this file under the terms of the MPL, indicate your
 * decision by deleting the provisions above and replace them with the notice
 * and other provisions required by the GPL or the LGPL. If you do not delete
 * the provisions above, a recipient may use your version of this file under
 * the terms of any one of the MPL, the GPL or the LGPL.
 *
 * ***** END LICENSE BLOCK ***** */

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
  var uri = Cc["@mozilla.org/network/io-service;1"]
            .getService(Ci.nsIIOService)
            .newURI("${PATH_CONTENT}/about-badges.html", "UTF-8", null);

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
        pHtml = ns.util.getTextFrom(pId, "about", "${EXT_NAME}", "https://github.com/hultmann/multifox/tree/${EXT_VERSION}");
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
