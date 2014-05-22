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

    return profileId in this._alias
         ? this._alias[profileId]
         : this.formatDefault(profileId);
  },


  formatShort: function(profileId) {
    return ProfileAlias.hasAlias(profileId)
         ? ProfileAlias.format(profileId)
         : profileId.toString();
  },


  formatDefault: function(profileId) {
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

    return ns.util.getText("button.menuitem.profile.extension.label", profileId);
  }
};


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
  var profileId = Profile.getIdentity(button.ownerDocument.defaultView);
  var txt = placement.area === "PanelUI-contents"
          ? ProfileAlias.format(profileId)       // panel
          : ProfileAlias.formatShort(profileId); // toolbar

  // show/hide label
  if (Profile.isExtensionProfile(profileId)) {
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

  doc.getElementById("PanelUI-popup")
     .addEventListener("popupshowing", onPanelUIShow, false);

  var panelView = doc.getElementById("PanelUI-multiView")
                     .appendChild(doc.createElement("panelview"));
  panelView.setAttribute("id", "${CHROME_NAME}-view-panel");
  panelView.setAttribute("flex", "1");
  panelView.classList.add("PanelUI-subView");
}


function onPanelUIShow(evt) {
  var win = evt.target.ownerDocument.defaultView;
  ErrorHandler.updateButtonAsync(win.getBrowser().selectedBrowser);
  updateButton(win);
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


function destroyButton(doc) {
  doc.getElementById("PanelUI-popup")
     .removeEventListener("popupshowing", onPanelUIShow, false);

  var panelView = doc.getElementById("${CHROME_NAME}-view-panel");
  panelView.parentNode.removeChild(panelView);

  var uri = Services.io.newURI("${PATH_CONTENT}/button.css", null, null);
  getDOMUtils(doc.defaultView).removeSheet(uri, 1);
}
