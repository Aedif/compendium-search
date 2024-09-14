const MODULE_ID = 'aedifs-compendium-search';

const BACKUP_ICONS = {
  JournalEntry: 'icons/svg/book.svg',
  Scene: 'icons/svg/ruins.svg',
};

const SEARCHABLE_WORLD_PACKS = [
  { pack: 'actors', title: 'DOCUMENT.Actors', documentName: 'Actor' },
  { pack: 'cards', title: 'DOCUMENT.CardsPlural', documentName: 'Cards' },
  { pack: 'items', title: 'DOCUMENT.Items', documentName: 'Item' },
  { pack: 'tables', title: 'DOCUMENT.RollTables', documentName: 'RollTable' },
  { pack: 'scenes', title: 'DOCUMENT.Scenes', documentName: 'Scene' },
  { pack: 'journal', title: 'DOCUMENT.JournalEntries', documentName: 'JournalEntry' },
];

class Search {
  static async init(html) {
    await getTemplate(`modules/${MODULE_ID}/templates/document-hits.html`);
    await getTemplate(`modules/${MODULE_ID}/templates/document-partial.html`);

    // Create a container for search results
    this.documentSearch = $('<ol class="document-hits"></ol>');
    this.documentSearch.on('click', '.name', this.onEntryClick);
    html.find('.directory-list').append(this.documentSearch);

    // Listen for input within the Search Bar and perform our own search
    html
      .find('.header-search > input[type="search"]')
      .on('input', async (event) => this.search(event.currentTarget.value))
      .trigger('input');

    // Assign context menu options for world pack results
    this._createContextMenu();
  }

  static search(term) {
    this.query = term;
    clearTimeout(this.searchTimeOut);
    this.searchTimeOut = setTimeout(Search._search.bind(Search), 250);
  }

  static _search() {
    const hits = [];

    let term = this.query;
    if (!term || term.length <= 2) return this.renderHits(hits);
    term = term
      .toLowerCase()
      .split(' ')
      .map((t) => t.trim())
      .filter((t) => t.length > 2);
    if (!term.length) return;

    // Filter hidden packs and Mass Edit preset packs
    let packs = game.packs.filter((p) => p.visible && !p.index.get('MassEditMetaData'));

    // Apply document type filters
    const filters = ui.compendium.activeFilters;
    if (filters?.length) {
      packs = packs.filter((p) => filters.includes(p.documentName));
    }

    // Search World Packs
    if (this.searchWorldPacks) {
      let wPacks = SEARCHABLE_WORLD_PACKS;

      if (filters?.length) {
        wPacks = wPacks.filter((p) => filters.includes(p.documentName));
      }

      wPacks.forEach((p) => {
        const documentName = p.documentName;
        const title = `${game.i18n.localize(p.title)} (${game.i18n.localize('PACKAGE.Type.world')})`;
        game[p.pack].forEach((i) => this._hitTest(i, documentName, title, term, hits));
      });
    }

    // Search Compendiums
    packs.forEach((p) => {
      const title = p.title;
      const documentName = p.documentName;
      p.index.forEach((i) => this._hitTest(i, documentName, title, term, hits));
    });

    this.renderHits(hits);
  }

  static _hitTest(i, documentName, title, term, hits) {
    let name = i.name?.toLowerCase();

    // If babele translation enabled and has original name
    let originalName = i.flags?.babele?.originalName?.toLowerCase();

    if (term.every((t) => name?.includes(t)) || term.every((t) => originalName?.includes(t))) {
      let typeLabel = documentName;
      if (documentName === 'Item' || documentName === 'Actor') {
        typeLabel = game.i18n.localize(CONFIG[documentName].typeLabels[i.type] ?? CONFIG[documentName].typeLabels.base);
      }

      hits.push({
        name: i.name,
        originalName: i.originalName,
        details: typeLabel + ' - ' + title,
        thumbnail: i.img ?? i.thumb ?? getDocumentClass(documentName).DEFAULT_ICON ?? BACKUP_ICONS[documentName],
        uuid: i.uuid,
        id: i.id,
        selector: documentName === 'Actor' ? 'actor' : 'other',
        documentName,
      });
    }
  }

  static async renderHits(hits) {
    const render = await renderTemplate(`modules/${MODULE_ID}/templates/document-hits.html`, { hits });
    this.documentSearch.html(render);
    this._createDragDropHandlers();
  }

  /**
   * Open document sheet on entry click
   * @param {*} event
   * @returns
   */
  static async onEntryClick(event) {
    event.preventDefault();
    const uuid = $(event.currentTarget).closest('.hit').data('uuid');

    const document = await fromUuid(uuid);
    if (!document) return;
    document.sheet.render(true);
  }

  static _onDragStart(event) {
    if (ui.context) ui.context.close({ animate: false });
    const uuid = $(event.currentTarget).closest('.hit').data('uuid');

    const result = foundry.utils.parseUuid(uuid);

    const dragData = {
      uuid,
      type: result.type ?? result.documentType, // v11
    };

    event.dataTransfer.setData('text/plain', JSON.stringify(dragData));
  }

  static _createDragDropHandlers() {
    // Drag Drop for Actors
    const ddActors = new DragDrop({
      dragSelector: '.hit.actor',
      permissions: {
        dragstart: () => game.user.can('TOKEN_CREATE'),
        drop: () => true,
      },
      callbacks: {
        dragstart: this._onDragStart,
      },
    });
    ddActors.bind(this.documentSearch[0]);

    const ddOther = new DragDrop({
      dragSelector: '.hit.other',
      permissions: {
        dragstart: () => true,
        drop: () => true,
      },
      callbacks: {
        dragstart: this._onDragStart,
      },
    });
    ddOther.bind(this.documentSearch[0]);
  }

  static _createContextMenu() {
    SEARCHABLE_WORLD_PACKS.forEach((p) => {
      ContextMenu.create(
        {
          // Faking an app here to return an empty array for v11 compatibility
          constructor: {
            _getInheritanceChain: () => {
              return [];
            },
          },
        },
        this.documentSearch,
        `[data-document-name="${game[p.pack].documentName}"]`,
        ui[p.pack]._getEntryContextOptions()
      );
    });
  }
}

Hooks.on('renderCompendiumDirectory', async (compendiumDirectory, html, options) => {
  Search.init(html);
});

Hooks.on('init', () => {
  game.settings.register(MODULE_ID, 'searchWorldPacks', {
    name: game.i18n.localize(`${MODULE_ID}.settings.searchWorldPacks.Name`),
    hint: game.i18n.localize(`${MODULE_ID}.settings.searchWorldPacks.Hint`),
    scope: 'world',
    config: true,
    type: Boolean,
    default: false,
    onChange: (val) => (Search.searchWorldPacks = val),
  });
  Search.searchWorldPacks = game.settings.get(MODULE_ID, 'searchWorldPacks');
});
