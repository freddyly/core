import Component from 'flarum/component';
import avatar from 'flarum/helpers/avatar';
import listItems from 'flarum/helpers/list-items';
import humanTime from 'flarum/utils/human-time';
import ItemList from 'flarum/utils/item-list';
import abbreviateNumber from 'flarum/utils/abbreviate-number';
import ActionButton from 'flarum/components/action-button';
import DropdownButton from 'flarum/components/dropdown-button';
import LoadingIndicator from 'flarum/components/loading-indicator';
import TerminalPost from 'flarum/components/terminal-post';

export default class DiscussionList extends Component {
  constructor(props) {
    super(props);

    this.loading = m.prop(true);
    this.moreResults = m.prop(false);
    this.discussions = m.prop([]);
    this.sort = m.prop(this.props.sort || 'recent');
    this.sortOptions = m.prop([
      {key: 'recent', value: 'Recent', sort: 'recent'},
      {key: 'replies', value: 'Replies', sort: '-replies'},
      {key: 'newest', value: 'Newest', sort: '-created'},
      {key: 'oldest', value: 'Oldest', sort: 'created'}
    ]);

    this.refresh();

    app.session.on('loggedIn', this.loggedInHandler = this.refresh.bind(this))
  }

  refresh() {
    m.startComputation();
    this.loading(true);
    this.discussions([]);
    m.endComputation();
    this.loadResults().then(this.parseResults.bind(this));
  }

  onunload() {
    app.session.off('loggedIn', this.loggedInHandler);
  }

  terminalPostType() {
    return ['newest', 'oldest'].indexOf(this.sort()) !== -1 ? 'start' : 'last'
  }

  countType() {
    return this.sort() === 'replies' ? 'replies' : 'unread';
  }

  loadResults(start) {
    var self = this;

    var sort = this.sortOptions()[0].sort;
    this.sortOptions().some(function(option) {
      if (option.key === self.sort()) {
        sort = option.sort;
        return true;
      }
    });

    var params = {sort, start};

    return app.store.find('discussions', params);
  }

  loadMore() {
    var self = this;
    this.loading(true);
    this.loadResults(this.discussions().length).then((results) => this.parseResults(results, true));
  }

  parseResults(results, append) {
    m.startComputation();
    this.loading(false);
    [].push.apply(this.discussions(), results);
    this.moreResults(!!results.meta.moreUrl);
    m.endComputation();
    return results;
  }

  markAsRead(discussion) {
    if (discussion.isUnread()) {
      discussion.save({ readNumber: discussion.lastPostNumber() });
      m.redraw();
    }
  }

  delete(discussion) {
    if (confirm('Are you sure you want to delete this discussion?')) {
      discussion.delete();
      this.removeDiscussion(discussion);
      if (app.current.discussion && app.current.discussion().id() === discussion.id()) {
        app.history.back();
      }
    }
  }

  removeDiscussion(discussion) {
    var index = this.discussions().indexOf(discussion);
    if (index !== -1) {
      this.discussions().splice(index, 1);
    }
  }

  view() {
    return m('div', [
      m('ul.discussions-list', [
        this.discussions().map(function(discussion) {
          var startUser = discussion.startUser()
          var isUnread = discussion.isUnread()
          var displayUnread = this.props.countType !== 'replies' && isUnread
          var jumpTo = Math.min(discussion.lastPostNumber(), (discussion.readNumber() || 0) + 1)

          var controls = this.controlItems(discussion).toArray();

          var discussionRoute = app.route('discussion', discussion);
          var active = m.route().substr(0, discussionRoute.length) === discussionRoute;

          return m('li.discussion-summary'+(isUnread ? '.unread' : '')+(active ? '.active' : ''), {key: discussion.id()}, [
            controls.length ? DropdownButton.component({
              items: controls,
              className: 'contextual-controls',
              buttonClass: 'btn btn-default btn-icon btn-sm btn-naked',
              menuClass: 'pull-right'
            }) : '',
            m('a.author', {
              href: app.route('user', startUser),
              config: function(element, isInitialized, context) {
                $(element).tooltip({ placement: 'right' })
                m.route.call(this, element)
              },
              title: 'Started by '+startUser.username()+' '+humanTime(discussion.startTime())
            }, [
              avatar(startUser, {title: ''})
            ]),
            m('ul.badges', listItems(discussion.badges().toArray())),
            m('a.main', {href: app.route('discussion.near', {id: discussion.id(), slug: discussion.slug(), near: jumpTo}), config: m.route}, [
              m('h3.title', discussion.title()),
              m('ul.info', listItems(this.infoItems(discussion).toArray()))
            ]),
            m('span.count', {onclick: this.markAsRead.bind(this, discussion)}, [
              abbreviateNumber(discussion[displayUnread ? 'unreadCount' : 'repliesCount']()),
              m('span.label', displayUnread ? 'unread' : 'replies')
            ])
          ])
        }.bind(this))
      ]),
      this.loading()
        ? LoadingIndicator.component()
        : (this.moreResults() ? m('div.load-more', ActionButton.component({
          label: 'Load More',
          className: 'control-loadMore btn btn-default',
          onclick: this.loadMore.bind(this)
        })) : '')
    ]);
  }

  /**
    Build an item list of info for a discussion listing. By default this is
    just the first/last post indicator.

    @return {ItemList}
   */
  infoItems(discussion) {
    var items = new ItemList();

    items.add('terminalPost',
      TerminalPost.component({
        discussion,
        lastPost: this.props.terminalPostType !== 'start'
      })
    );

    return items;
  }

  /**
    Build an item list of controls for a discussion listing.

    @return {ItemList}
   */
  controlItems(discussion) {
    var items = new ItemList();

    if (discussion.canDelete()) {
      items.add('delete', ActionButton.component({
        icon: 'times',
        label: 'Delete',
        onclick: this.delete.bind(this, discussion)
      }));
    }

    return items;
  }
}