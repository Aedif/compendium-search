const MODULE_ID = 'aedifs-compendium-search';

const SEARCHABLE_PACKS = ['Actor', 'Item'];

Hooks.on('renderCompendiumDirectory', async (compendiumDirectory, html, options) => {
  const documentSearch = $('<ol class="document-hits"></ol>');
  documentSearch.on('click', '.name', onEntryClick);

  html.find('.directory-list').append(documentSearch);

  html.find('.header-search > input[type="search"]').on('input', async (event) => {
    const hits = search(event.currentTarget.value);
    await renderHits(hits, documentSearch);
  });

  await getTemplate(`modules/${MODULE_ID}/templates/document-hits.html`);
  await getTemplate(`modules/${MODULE_ID}/templates/document-partial.html`);
});

function search(term) {
  const hits = [];

  if (!term || term.length <= 2) return hits;
  term = term.toLowerCase();

  game.packs
    .filter((p) => p.visible && !p.index.get('MassEditMetaData'))
    .forEach((p) => {
      const title = p.title;
      const documentName = p.documentName;

      //const cls = getDocumentClass(documentName);

      p.index.forEach((i) => {
        if (i.name?.toLowerCase().includes(term)) {
          let typeLabel = documentName;
          if (documentName === 'Item' || documentName === 'Actor') {
            typeLabel = game.i18n.localize(
              CONFIG[documentName].typeLabels[i.type] ?? CONFIG[documentName].typeLabels.base
            );
          }

          hits.push({
            name: i.name,
            details: typeLabel + ' - ' + title,
            thumbnail: i.img ?? i.thumb ?? getDocumentClass(documentName).DEFAULT_ICON,
            uuid: i.uuid,
          });
        }
      });
    });

  return hits;
}

async function renderHits(hits, documentSearch) {
  const render = await renderTemplate(`modules/${MODULE_ID}/templates/document-hits.html`, { hits });
  documentSearch.html(render);
  _createDragDropHandlers(documentSearch);
}

async function onEntryClick(event) {
  event.preventDefault();
  const uuid = $(event.currentTarget).closest('.hit').data('uuid');

  const document = await fromUuid(uuid);
  if (!document) return;
  document.sheet.render(true);
}

function _createDragDropHandlers(documentSearch) {
  const dd = new DragDrop({
    dragSelector: '.hit',
    permissions: {
      dragstart: () => {
        return true;
      },
      drop: () => true,
    },
    callbacks: {
      dragstart: _onDragStart,
      //dragover: (...args) => console.log('dragover', ...args),
      drop: (...args) => console.log('drop', ...args),
    },
  });

  dd.bind(documentSearch[0]);
}

function _onDragStart(event) {
  if (ui.context) ui.context.close({ animate: false });
  const uuid = $(event.currentTarget).closest('.hit').data('uuid');

  const result = foundry.utils.parseUuid(uuid);

  const dragData = {
    type: result.type,
    uuid,
  };
  console.log(dragData);

  event.dataTransfer.setData('text/plain', JSON.stringify(dragData));
}
