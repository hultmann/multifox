/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */


var ProfileAlias = {
  _alias: null,

  _load: function() {
    var prefs = Services.prefs.getBranch("extensions.${EXT_ID}.");
    if (prefs.prefHasUserValue("alias") === false) {
      this._alias = Object.create(null);
      return;
    }

    var a = prefs.getComplexValue("alias", Ci.nsISupportsString).data;
    try {
      this._alias = JSON.parse(a);
    } catch (ex) {
      console.log(ex + " - buggy json - " + a);
      this._alias = Object.create(null);
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
    if (this._alias === null) {
      this._load();
    }

    var ns = {}; // BUG util is undefined???
    Cu.import("${PATH_MODULE}/new-window.js", ns);

    switch (profileId) {
      case Profile.DefaultIdentity:
        return ns.util.getText("button.menuitem.profile.default.label");

      case Profile.PrivateIdentity:
        return ns.util.getText("button.menuitem.profile.private.label");

      case Profile.UndefinedIdentity:
        throw new Error("unexpected Profile.UndefinedIdentity");
    }
    console.assert(Profile.isExtensionProfile(profileId), "profileId unexpected", profileId);

    if (profileId in this._alias) {
      return this._alias[profileId];
    }

    return ns.util.getText("button.menuitem.profile.extension.label", profileId);
  }
};



function updateButtonDeprecated(win) {
  var doc = win.document;
  var button = getButtonElem(doc);
  if (button === null) { // visible?
    return;
  }

  // show <dropmarker> (hidden by class bookmark-item)
  doc.getAnonymousElementByAttribute(button, "class", "toolbarbutton-menu-dropmarker")
     .setAttribute("style", "display:-moz-box !important");

  // update label
  var txt;
  var profileId = Profile.getIdentity(win);
  if (Profile.isExtensionProfile(profileId)) {
    txt = ProfileAlias.hasAlias(profileId) ? ProfileAlias.format(profileId)
                                           : profileId.toString();
  } else {
    txt = "";
  }

  button.setAttribute("label", txt);
}


function updateButton(win) {
  var button = getButtonElem(win.document);
  if (button !== null) { // null during onWidgetAdded? onCreated will update it
    updateButtonCore(button);
  }
}


function updateButtonCore(button) {
  var ui = Cu.import("resource:///modules/CustomizableUI.jsm", {}).CustomizableUI;
  var placement = ui.getPlacementOfWidget("${CHROME_NAME}-button");
  if (placement === null) {
    return;
  }

  // update label
  var txt = "";
  var profileId = Profile.getIdentity(button.ownerDocument.defaultView);

  if (placement.area === "PanelUI-contents") {
    txt = ProfileAlias.format(profileId);
  } else {
    // toolbar
    if (Profile.isExtensionProfile(profileId)) {
      txt = ProfileAlias.hasAlias(profileId) ? ProfileAlias.format(profileId)
                                             : profileId.toString();
    }
  }

  // show/hide label
  if (txt.length > 0) {
    button.setAttribute("show-label", "true");
  } else {
    button.removeAttribute("show-label");
  }

  button.setAttribute("label", txt);
}



function getButtonElem(doc) {
  return doc.getElementById("${CHROME_NAME}-button");
}


function insertButtonView(doc) {
  console.assert(doc.getElementById("${CHROME_NAME}-view-panel") === null, "panelview already exists");

  var uri = Services.io.newURI("${PATH_CONTENT}/button.css", null, null);
  getDOMUtils(doc.defaultView).loadSheet(uri, 1);

  var panelView = doc.getElementById("PanelUI-multiView")
                     .appendChild(doc.createElement("panelview"));
  panelView.setAttribute("id", "${CHROME_NAME}-view-panel");
  panelView.setAttribute("flex", "1");
  panelView.classList.add("PanelUI-subView");
}


function registerButton(create) {
  var ui = Cu.import("resource:///modules/CustomizableUI.jsm", {}).CustomizableUI;
  var buttonId = "${CHROME_NAME}-button";

  if (create === false) {
    ui.destroyWidget(buttonId);
    return;
  }


  ui.createWidget({
    defaultArea: ui.AREA_NAVBAR,
    type: "view",
    id: buttonId,
    viewId: "${CHROME_NAME}-view-panel",
    label: "${EXT_NAME}", // non-empty to avoid "Could not localize property" message
    tooltiptext: "${EXT_NAME}",

    onCreated: function(button) {
      updateButtonCore(button);
    },

    onViewShowing : function(evt) {
      emptyNode(evt.target);

      var doc = evt.target.ownerDocument;
      doc.defaultView.requestAnimationFrame(function() {
        // it is hopefully the visible element, after the reinsertion
        Cu.import("${PATH_MODULE}/commands.js", {}).renderMenu(doc);
      });
    },

    onViewHiding : function(evt) {
      emptyNode(evt.target);
    }
  });

  ui.addListener({
    onWidgetAdded: function(widgetId, area, position) {
      if (widgetId === "${CHROME_NAME}-button") {
        var enumWin = Services.wm.getEnumerator("navigator:browser");
        while (enumWin.hasMoreElements()) {
          updateButton(enumWin.getNext());
        }
      }
    }
  });
}


function emptyNode(node) {
  while (node.firstChild !== null) {
    node.removeChild(node.firstChild);
  };
}


function insertButton(doc) {
  console.assert(getButtonElem(doc) === null, "insertButton dupe");

  // restore icon after toolbar customization
  doc.defaultView.addEventListener("aftercustomization", customizeToolbar, false);

  var buttonId = "${CHROME_NAME}-button";

  // add it to <toolbarpalette>
  doc.getElementById("navigator-toolbox")
     .palette.appendChild(createButtonElem(doc, buttonId));

  // add it to <toolbar>
  var toolbar = ButtonPersistence.findToolbar(doc, buttonId);
  if (toolbar != null) {
    if (fixToolbarBug(toolbar)) {
      return;
    }

    var button0 = ButtonPersistence.getPrecedingButton(toolbar, buttonId);
    toolbar.insertItem(buttonId, button0, null, false);
    return;
  }

  // add it to default position
  var ns = {};
  Cu.import("${PATH_MODULE}/new-window.js", ns); // BUG Bootstrap is undefined
  if (ns.Bootstrap.showButtonByDefault === false) {
    return; // keep button hidden
  }

  toolbar = doc.getElementById("nav-bar");
  toolbar.insertItem(buttonId);
  ButtonPersistence.saveToolbar(toolbar);
}


// bug introduced in version 2.0.0...2.0.5
function fixToolbarBug(toolbar) {
  if (toolbar.id !== "nav-bar") {
    return false;
  }
  if (toolbar.getAttribute("currentset") !== ",multifox-button") {
    return false;
  }

  toolbar.setAttribute("currentset", "");
  var doc = toolbar.ownerDocument;
  doc.persist(toolbar.id, "currentset");

  var ns = {};
  Cu.import("${PATH_MODULE}/new-window.js", ns);
  ns.Bootstrap.resetButton();

  doc.getElementById("cmd_newNavigator").doCommand();
  return true;
}


function createButtonElem(doc, buttonId) {
  var button = doc.createElement("toolbarbutton");
  button.setAttribute("id", buttonId);
  button.setAttribute("tab-status", "");
  button.setAttribute("type", "menu");
  button.setAttribute("class", "bookmark-item"); // show label beside its icon
  button.setAttribute("style", "list-style-image:url(${PATH_CONTENT}/favicon.ico);-moz-image-region:auto");
  button.setAttribute("label", "${EXT_NAME}");
  button.setAttribute("tooltiptext", "${EXT_NAME}");
  var menupopup = button.appendChild(doc.createElement("menupopup"));
  menupopup.addEventListener("popupshowing", onMenuPopupShowing, false);
  return button;
}


var ButtonPersistence = {
  saveToolbar: function(toolbar) {
    toolbar.setAttribute("currentset", toolbar.currentSet);
    toolbar.ownerDocument.persist(toolbar.id, "currentset");
  },

  removeButton: function(buttonId) {
    var enumWin = Services.wm.getEnumerator("navigator:browser");
    while (enumWin.hasMoreElements()) {
      var doc = enumWin.getNext().document;
      var toolbar = ButtonPersistence.findToolbar(doc, buttonId);
      if (toolbar !== null) {
        ButtonPersistence.saveToolbar(toolbar);
      }
    }
  },

  findToolbar: function(doc, buttonId) {
    var bars = doc.getElementsByTagName("toolbar");
    for (var idx = bars.length - 1; idx > -1; idx--) {
      var all = ButtonPersistence._getToolbarButtons(bars[idx]);
      if (all.indexOf(buttonId) > -1) {
        return bars[idx];
      }
    }
    return null;
  },

  getPrecedingButton: function(toolbar, id) {
    var all = ButtonPersistence._getToolbarButtons(toolbar);
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
    return null;
  },

  _getToolbarButtons: function(toolbar) {
    // it may be empty
    return toolbar.getAttribute("currentset").split(",");
  }
};


function destroyButtonDeprecated(doc) {
   doc.defaultView.removeEventListener("aftercustomization", customizeToolbar, false);

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
    button.parentNode.removeChild(button); // button position is persisted until uninstall
  }
}


function customizeToolbar(evt) {
  var toolbox = evt.target;
  updateButtonDeprecated(toolbox.ownerDocument.defaultView);
}


function destroyButton(doc) {
  var panelView = doc.getElementById("${CHROME_NAME}-view-panel");
  panelView.parentNode.removeChild(panelView);

  var uri = Services.io.newURI("${PATH_CONTENT}/button.css", null, null);
  getDOMUtils(doc.defaultView).removeSheet(uri, 1);
}


function onMenuPopupShowing(evt) {
  if (evt.currentTarget === evt.target) {
    var ns = {};
    Cu.import("${PATH_MODULE}/actions.js", ns);
    ns.menuButtonShowing(evt.target);
  }
}
