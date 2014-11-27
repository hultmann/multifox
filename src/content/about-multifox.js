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
  var am = Components.utils.import("resource://gre/modules/AddonManager.jsm", null).AddonManager;
  am.getAddonByID("${EXT_ID}", function(addon) {
    document.getElementById("desc").appendChild(document.createTextNode(addon.description));
  });
}


function populatePage() {
  var util = Components.utils.import("${PATH_MODULE}/new-window.js", null).util;

  var items = ["author", "l10n", "source", "legal"];
  for (var idx = items.length - 1; idx > -1; idx--) {
    var id = items[idx];
    var hHtml = util.getTextFrom(id + ".h", "about-multifox");
    var pHtml;
    var attrs = null;

    switch (id) {
      case "author":
        pHtml = util.getTextFrom("author.text", "about-multifox",
                                 "a1", "/a1",
                                 "a2", "/a2",
                                 "a3", "/a3");
        attrs = {
          "a1": "https://github.com/hultmann/multifox/issues",
          "a2": "https://twitter.com/multifox",
          "a3": "mailto:hultmann@gmail.com"
        };
        break;

      case "source":
        pHtml = util.getTextFrom("source.text", "about-multifox", "${EXT_NAME}", "a1", "/a1");
        attrs = { "a1": "${SOURCE_URL}" };
        break;

      case "l10n":
        var reg = Cc["@mozilla.org/chrome/chrome-registry;1"]
                    .getService(Ci.nsIXULChromeRegistry);
        var localeApp = reg.getSelectedLocale("global");
        var localeExt = reg.getSelectedLocale("${EXT_HOST}");

        hHtml = util.getTextFrom(id + ".h", "about-multifox", localeExt);

        if (hasExtensionLocale(localeApp)) {
          pHtml = util.getTextFrom("l10n.p", "about-multifox").trim();
          if (pHtml.length === 0) {
            continue;
          }
        } else {
          pHtml = 'Multifox is not yet available in your language (' + localeApp + '). <a1>Please join BabelZilla if you are interested in localizing it!</a1>';
        }

        attrs = {
          "a1": "https://getmultifox.com/bugs/"
        };
        break;

      case "legal":
        pHtml = util.getTextFrom("legal.p", "about-multifox");
        break;

      default:
        throw new Error();
    }

    // <h2>
    document.getElementById(id + "-h").appendChild(document.createTextNode(hHtml));

    // <p>
    var elem = document.getElementById(id + "-p");
    markupProcessor(pHtml, function(tag, text) {
      if (tag.length === 0) {
        elem.appendChild(document.createTextNode(text));
      } else {
        var a = elem.appendChild(document.createElement("a"));
        a.appendChild(document.createTextNode(text));
        a.setAttribute("href", attrs[tag]);
      }
    });

  }
}


function markupProcessor(str, callback) {
  var lastTag = null;
  var frags = str.split("<");
  for (var idx = 0, len = frags.length; idx < len; idx++) {
    if (!frags[idx].contains(">")) {
      callback("", frags[idx]);
      continue;
    }

    var [tag, text] = frags[idx].split(">", 2);
    if (tag[0] === "/") {
      console.assert(("/" + lastTag) === tag, "no matching tag", lastTag, tag);
      callback("", text);
    } else {
      lastTag = tag;
      callback(tag, text);
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
