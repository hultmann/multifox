/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */


var ProfileAlias = {
  _alias: null,

  _load: function() {
    var prefs = Services.prefs.getBranch("extensions.${EXT_ID}.");
    if (prefs.prefHasUserValue("alias") === false) {
      this._alias = {__proto__: null};
      return;
    }

    var a = prefs.getComplexValue("alias", Ci.nsISupportsString).data;
    try {
      this._alias = JSON.parse(a);
    } catch (ex) {
      console.log(ex + " - buggy json - " + a);
      this._alias = {__proto__: null};
    }
  },


  rename: function(profileId, name) {
    if (name.length > 0) {
      this._alias[profileId] = name;
    } else {
      delete this._alias[profileId];
    }
    var ns = {}; // BUG util is undefined???
    Cu.import("${PATH_MODULE}/new-window.js", ns);
    ns.util.setUnicodePref("alias", JSON.stringify(this._alias));
  },


  remove: function(profileId) {
    delete this._alias[profileId];
    var ns = {}; // BUG util is undefined???
    Cu.import("${PATH_MODULE}/new-window.js", ns);
    ns.util.setUnicodePref("alias", JSON.stringify(this._alias));
  },

  sort: function(arr) {
    if (this._alias === null) {
      this._load();
    }
    var me = this;
    arr.sort(function(id1, id2) {
      return me.format(id1).localeCompare(me.format(id2));
    });
    return arr;
  },

  hasAlias: function(profileId) {
    if (this._alias === null) {
      this._load();
    }
    return profileId in this._alias;
  },

  format: function(profileId) {
    console.assert(this._alias !== null, "call ProfileAlias._load");

    var ns = {}; // BUG util is undefined???
    Cu.import("${PATH_MODULE}/new-window.js", ns);

    if (profileId <= Profile.DefaultIdentity) {
      return ns.util.getText("button.profile-default.label");
    }

    if (profileId in this._alias) {
      return this._alias[profileId];
    }

    return ns.util.getText("button.profile-generic.label", profileId);
  }
};



function updateButton(win) {
  var profileId = Profile.getIdentity(win);

  var txt;
  if (profileId > Profile.DefaultIdentity) {
    txt = ProfileAlias.hasAlias(profileId) ? ProfileAlias.format(profileId)
                                           : profileId.toString();
  } else {
    txt = "";
  }

  var button = getButtonElem(win.document);
  if (button !== null) { // visible?
    button.setAttribute("label", txt);
    styleButton(button);
  }
}


function styleButton(button) {
  // show label beside its icon (is there a better way to do that?)

  if (Services.appinfo.OS === "Darwin") {
    button.setAttribute("class", "chromeclass-toolbar-additional toolbarbutton-1");
  } else {
    // toolbarbutton-1 looks broken
    button.setAttribute("class", "chromeclass-toolbar-additional");
  }

  // -moz-box-orient=> label position
  // display=> needed for popups
  button.setAttribute("style", "-moz-box-orient:horizontal !important; display:-moz-box !important;");
  var anonNodes = button.ownerDocument.getAnonymousNodes(button);
  for (var idx = anonNodes.length - 1; idx > -1; idx--) {
    if (anonNodes[idx].tagName === "xul:label") {
      anonNodes[idx].setAttribute("style", "display: -moz-box !important;");
      break;
    }
  }
}


function getButtonElem(doc) {
  return doc.getElementById("${CHROME_NAME}-button");
}


function createButton(doc) {
  console.assert(getButtonElem(doc) === null, "createButton dupe");
  var buttonId = "${CHROME_NAME}-button";

  // add it to <toolbarpalette>
  doc.getElementById("navigator-toolbox")
     .palette.appendChild(createElement(doc, buttonId));

  // add it to <toolbar>
  var toolbar = findButtonLocation(doc, buttonId);
  if (toolbar != null) {
    var button0 = getPrecedingButton(toolbar, buttonId);
    toolbar.insertItem(buttonId, button0, null, false);
    return;
  }

  // add it to default position
  toolbar = doc.getElementById("nav-bar");
  toolbar.insertItem(buttonId);
  saveButtonSet(toolbar, toolbar.getAttribute("currentset") + "," + buttonId);
}


function createElement(doc, buttonId) {
  var button = doc.createElement("toolbarbutton");
  button.setAttribute("id", buttonId);
  button.setAttribute("tab-status", "");
  button.setAttribute("type", "menu");
  button.setAttribute("image", "${PATH_CONTENT}/favicon.ico");
  button.setAttribute("label", "");
  button.setAttribute("tooltiptext", "${EXT_NAME}");
  var menupopup = button.appendChild(doc.createElement("menupopup"));
  menupopup.addEventListener("popupshowing", onMenuPopupShowing, false);
  return button;
}


function saveButtonSet(toolbar, newSet) {
  toolbar.setAttribute("currentset", newSet);
  toolbar.ownerDocument.persist(toolbar.id, "currentset");
}


function removeFromButtonSet() {
  var buttonId = "${CHROME_NAME}-button";
  var enumWin = Services.wm.getEnumerator("navigator:browser");
  while (enumWin.hasMoreElements()) {
    var doc = enumWin.getNext().document;
    var toolbar = findButtonLocation(doc, buttonId);
    if (toolbar === null) {
      continue;
    }
    var all = toolbar.getAttribute("currentset").split(",");
    var removed = all.splice(all.indexOf(buttonId), 1);
    console.assert(removed.length > 0, "button not found");
    saveButtonSet(toolbar, all.join(","));
  }
}


function findButtonLocation(doc, buttonId) {
  var bars = doc.getElementsByTagName("toolbar");
  for (var idx = bars.length - 1; idx > -1; idx--) {
    var all = bars[idx].getAttribute("currentset").split(",");
    if (all.indexOf(buttonId) > -1) {
      return bars[idx];
    }
  }
  return null;
}


function getPrecedingButton(toolbar, id) {
  var all = toolbar.getAttribute("currentset").split(",");
  var idxButton = all.indexOf(id);
  if (idxButton === -1) {
    throw new Error("button not found @ " + toolbar.id);
  }
  var doc = toolbar.ownerDocument;
  for (var idx = idxButton + 1, len = all.length; idx < len; idx++) {
    var beforeNode = doc.getElementById(all[idx]);
    if (beforeNode !== null) {
      return beforeNode;
    }
  }
}


function destroyButton(doc) {
  var plt = doc.getElementById("navigator-toolbox").palette;
  var button2 = plt.children.namedItem("${CHROME_NAME}-button");
  if (button2 !== null) {
    plt.removeChild(button2);
  }

  var button = getButtonElem(doc);
  if (button !== null) {
    var menu = button.firstChild;
    console.assert(menu.tagName === "menupopup", "wrong element: " + menu.tagName)
    menu.removeEventListener("popupshowing", onMenuPopupShowing, false);
    button.parentNode.removeChild(button);
  }
}


function onMenuPopupShowing(evt) {
  if (evt.currentTarget === evt.target) {
    var ns = {};
    Cu.import("${PATH_MODULE}/actions.js", ns);
    ns.menuButtonShowing(evt.target);
  }
}
