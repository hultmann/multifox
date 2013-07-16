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
    util.setUnicodePref("alias", JSON.stringify(this._alias));
  },


  remove: function(profileId) {
    delete this._alias[profileId];
    util.setUnicodePref("alias", JSON.stringify(this._alias));
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

    if (profileId <= Profile.DefaultIdentity) {
      return util.getText("button.profile-default.label");
    }

    if (profileId in this._alias) {
      return this._alias[profileId];
    }

    return util.getText("button.profile-generic.label", profileId);
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

  var button = win.document.getElementById("${CHROME_NAME}-button");
  if (button !== null) { // visible?
    button.setAttribute("label", txt);
    styleButton(button);
  }
}


function styleButton(button) {
  // show label beside its icon (is there a better way to do that?)
  button.setAttribute("class", "chromeclass-toolbar-additional");// don't use toolbarbutton-1
  button.setAttribute("style", "-moz-box-orient: horizontal !important;");
  var anonNodes = button.ownerDocument.getAnonymousNodes(button);
  for (var idx = anonNodes.length - 1; idx > -1; idx--) {
    if (anonNodes[idx].tagName === "xul:label") {
      anonNodes[idx].setAttribute("style", "display: -moz-box !important;");
      break;
    }
  }
}


function createButton(doc) {
  // add to palette
  var buttonId = "${CHROME_NAME}-button";
  doc.getElementById("navigator-toolbox").palette.appendChild(createElement(doc, buttonId));

  // persist button
  var toolbar = doc.getElementById("nav-bar");
  if (toolbar.currentSet.split(",").indexOf(buttonId) > -1) {
    return;
  }
  var newSet = toolbar.currentSet + "," + buttonId;
  toolbar.setAttribute("currentset", newSet);
  toolbar.currentSet = newSet;
  doc.persist("nav-bar", "currentset");
  doc.defaultView.BrowserToolboxCustomizeDone(true);
}


function createElement(doc, buttonId) {
  var button = doc.createElement("toolbarbutton");
  button.setAttribute("id", buttonId);
  button.setAttribute("type", "menu");
  button.setAttribute("image", "${PATH_CONTENT}/favicon.ico");
  button.setAttribute("label", "");
  button.setAttribute("tooltiptext", "${EXT_NAME}");
  var menupopup = button.appendChild(doc.createElement("menupopup"));
  menupopup.addEventListener("popupshowing", onMenuPopupShowing, false);
  return button;
}


function destroyButton(doc) {
  var plt = doc.getElementById("navigator-toolbox").palette;
  var button2 = plt.children.namedItem("${CHROME_NAME}-button");
  if (button2 !== null) {
    plt.removeChild(button2);
  }

  var button = doc.getElementById("${CHROME_NAME}-button");
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
    Components.utils.import("${PATH_MODULE}/actions.js", ns);
    ns.menuButtonShowing(evt.target);
  }
}
