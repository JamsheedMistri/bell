const m = require('mithril')
const PopupModel = require('../PopupModel').default

var Popup = {
  oninit: function (vnode) {
    vnode.attrs.popupModel = new PopupModel(vnode.attrs.source)
    vnode.attrs.popupModel.initialize()
  },
  view: function (vnode) {
    if (!vnode.attrs.popupModel.visible) { return }
    var bellTimer = vnode.attrs.bellTimer
    var theme = vnode.attrs.themeManager.currentTheme.theme(bellTimer)

    return m('span', {
      style: {
        visibility: (vnode.attrs.popupModel.visible) ? 'visible' : 'hidden' }
    }, m('.top.right.popup.fade-in', {
      style: theme.contrast
    }, m('table', m('tr', [
      m('td', m(`${vnode.attrs.popupModel.href ? 'a.link' : 'span'}.center-vertical[target=_blank]`, {
        href: vnode.attrs.popupModel.href,
        style: theme.subtext
      }, vnode.attrs.popupModel.text)),
      m('td', m('a.dismiss.center-vertical[href=javascript:void(0)]', {
        onclick: function () {
          vnode.attrs.popupModel.visible = false
        }
      }, m('i.dismiss-icon.material-icons', 'cancel')))
    ]))))
  },
  onremove: function (vnode) {
    vnode.attrs.popupModel.stopRefreshing()
  }
}

module.exports = Popup
