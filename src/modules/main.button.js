/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */


var ProfileAlias = {
  _alias: null,

  _checkLoad: function() {
    if (this._alias !== null) {
      return;
    }

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


  registerProfile: function(profileId, name = undefined) {
    this._checkLoad();

    if (name !== undefined) {
      this._alias[profileId] = name;
    } else {
      if (profileId in this._alias) {
        return;
      }
      // new profile / populate _alias
      this._alias[profileId] = "";
    }

    // BUG util is undefined???
    Cu.import("${PATH_MODULE}/new-window.js", null).
      util.
        setUnicodePref("alias", JSON.stringify(this._alias));
  },


  remove: function(profileId) {
    this._checkLoad();
    delete this._alias[profileId];
    // BUG util is undefined???
    Cu.import("${PATH_MODULE}/new-window.js", null).
      util.
        setUnicodePref("alias", JSON.stringify(this._alias));
  },


  clear: function() {
    Services.prefs.getBranch("extensions.${EXT_ID}.").clearUserPref("alias");
    this._alias = null;
  },


  getRegisteredProfiles: function() {
    this._checkLoad();
    var rv = [];
    for (var id in this._alias) {
      var profileId = Profile.toInt(id);
      if (Profile.isExtensionProfile(profileId)) {
        rv.push(profileId);
      }
    }
    return rv;
  },


  sort: function(arr) {
    this._checkLoad();
    var me = this;
    arr.sort(function(id1, id2) { // BUG Profile 10, 11, 2, ...
      return me.format(id1).localeCompare(me.format(id2));
    });
    return arr;
  },

  hasAlias: function(profileId) {
    this._checkLoad();

    if (profileId in this._alias) {
      var name = this._alias[profileId];
      if (name.length > 0) {
         return true;
      }
    }

    return false;
  },

  format: function(profileId) {
    return ProfileAlias.hasAlias(profileId)
         ? this._alias[profileId]
         : this._formatDefault(profileId);
  },


  formatShort: function(profileId) {
    return ProfileAlias.hasAlias(profileId)
         ? this._alias[profileId]
         : profileId.toString();
  },


  _formatDefault: function(profileId) {
    // BUG util is undefined???
    var util = Cu.import("${PATH_MODULE}/new-window.js", null).util;

    switch (profileId) {
      case Profile.DefaultIdentity:
        return util.getText("button.menuitem.profile.default.label");

      case Profile.PrivateIdentity:
        return util.getText("button.menuitem.profile.private.label");
    }

    return util.getText("button.menuitem.profile.extension.label", profileId);
  }
};


function updateButton(win) {
  var button = getButtonElem(win.document);
  if (button !== null) { // null during onWidgetAdded? onCreated will update it
    updateButtonLabel(button);
  }
}


function updateButtonLabel(button) {
  var placement = Cu.import("resource:///modules/CustomizableUI.jsm", null).
                    CustomizableUI.
                      getPlacementOfWidget("${CHROME_NAME}-button");
  if (placement === null) {
    return;
  }

  var tab = UIUtils.getSelectedTab(button.ownerDocument.defaultView);
  var profileId = Profile.getIdentity(tab.linkedBrowser);

  // default profile
  if (Profile.isNativeProfile(profileId)) {
    button.removeAttribute("badge");
    button.classList.remove("badged-button");
    button.removeAttribute("show-label");
    button.setAttribute("label", ProfileAlias.format(profileId));
    return;
  }

  // popup
  if (placement.area === "PanelUI-contents") {
    button.removeAttribute("badge");
    button.classList.remove("badged-button");
    button.setAttribute("show-label", "true");
    button.setAttribute("label", ProfileAlias.format(profileId));
    return;
  }

  // toolbar
  var name = ProfileAlias.formatShort(profileId);
  button.setAttribute("label", name);

  if (name.length > 5) {
    button.removeAttribute("badge");
    button.classList.remove("badged-button");
    button.setAttribute("show-label", "true");
  } else {
    button.setAttribute("badge", name);
    button.classList.add("badged-button");
    button.removeAttribute("show-label");
  }
}



function getButtonElem(doc) {
  return doc.getElementById("${CHROME_NAME}-button");
}


function insertButtonView(doc) {
  console.assert(doc.getElementById("${CHROME_NAME}-view-panel") === null, "panelview already exists");

  var uri = Services.io.newURI("${PATH_CONTENT}/button.css", null, null);
  UIUtils.getDOMUtils(doc.defaultView).loadSheet(uri, 1);

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
  ErrorHandler.updateButtonAsync(UIUtils.getSelectedTab(win).linkedBrowser);
  updateButton(win); // necessary only when placement.area === "PanelUI-contents"
}


function registerButton(create) {
  var ui = Cu.import("resource:///modules/CustomizableUI.jsm", null).CustomizableUI;
  var buttonId = "${CHROME_NAME}-button";

  if (create === false) {
    ui.removeListener(WidgetListeners);
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
      updateButtonLabel(button);
    },

    onViewShowing : function(evt) {
      Cu.import("${PATH_MODULE}/new-window.js", null).util.emptyNode(evt.target);

      var doc = evt.target.ownerDocument;
      doc.defaultView.requestAnimationFrame(function() {
        // it is hopefully the visible element, after the reinsertion
        Cu.import("${PATH_MODULE}/commands.js", null).
          getProfileListMenu().
          renderToolbarMenu(doc);
      });
    },

    onViewHiding : function(evt) {
      Cu.import("${PATH_MODULE}/new-window.js", null).util.emptyNode(evt.target);
    }
  });

  ui.addListener(WidgetListeners);
}


var WidgetListeners = {
  onWidgetAdded: function(widgetId, area, position) {
    if (widgetId === "${CHROME_NAME}-button") {
      var enumWin = Services.wm.getEnumerator("navigator:browser");
      while (enumWin.hasMoreElements()) {
        updateButton(enumWin.getNext());
      }
    }
  }
};


function destroyButton(doc) {
  doc.getElementById("PanelUI-popup")
     .removeEventListener("popupshowing", onPanelUIShow, false);

  var panelView = doc.getElementById("${CHROME_NAME}-view-panel");
  panelView.parentNode.removeChild(panelView);

  var uri = Services.io.newURI("${PATH_CONTENT}/button.css", null, null);
  UIUtils.getDOMUtils(doc.defaultView).removeSheet(uri, 1);
}
