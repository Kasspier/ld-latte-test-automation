// Shared pure functions; the generator embeds this exact code in n8n Code nodes.
// Telegram transport and database credentials are intentionally absent here.
export function normalizeUpdate(envelope) {
  const update = envelope?.update;
  if (!Number.isSafeInteger(update?.update_id) || update.update_id < 0) {
    return {action: 'ignore', reason: 'invalid_update'};
  }
  const callback = update.callback_query;
  const message = callback ? callback.message : update.message;
  const actor = callback ? callback.from : message?.from;
  const chat = message?.chat;
  if (chat?.type !== 'private' || !Number.isSafeInteger(chat.id) || chat.id <= 0 || actor?.id !== chat.id || actor?.is_bot) {
    return {action: 'ignore', reason: 'private_chat_only'};
  }
  const context = {updateId: update.update_id, chatId: chat.id};
  if (callback) {
    const match = /^svc:([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$/i.exec(callback.data ?? '');
    return {...context, action: match ? 'select' : 'invalid_callback', serviceId: match ? match[1].toLowerCase() : ''};
  }
  const match = /^\/start(?:@([a-z0-9_]+))?(?:\s+.*)?$/i.exec(message.text?.trim() ?? '');
  if (match?.[1] && match[1].toLowerCase() !== String(envelope.bot_username ?? '').toLowerCase()) {
    return {...context, action: 'ignore', reason: 'other_bot'};
  }
  return {...context, action: match ? 'start' : 'help', serviceId: ''};
}

export function buildResponse(context, services) {
  if (context.action === 'ignore') return {actions: []};
  if (!Array.isArray(services)) throw new Error('Invalid catalog response');
  const active = services.filter(row => row.active === true);
  const send = (text, keyboard) => ({method: 'sendMessage', body: {
    chat_id: context.chatId,
    text,
    ...(keyboard ? {reply_markup: {inline_keyboard: keyboard}} : {}),
  }});
  if (context.action === 'start') {
    if (!active.length) return {actions: [send('Сейчас активных услуг нет. Пожалуйста, попробуйте позже.')]};
    const actions = [];
    // One row per service; split large catalogs without hiding any active service.
    for (let i = 0; i < active.length; i += 50) {
      const rows = active.slice(i, i + 50).map(row => [{text: row.name, callback_data: `svc:${row.id}`}]);
      actions.push(send(i ? 'Продолжение списка услуг:' : 'Здравствуйте! Выберите услугу:', rows));
    }
    return {actions};
  }
  if (context.action === 'select') {
    const selected = active.find(row => row.id.toLowerCase() === context.serviceId);
    return {actions: [send(selected ? `Вы выбрали: ${selected.name}` : 'Эта услуга больше недоступна. Обновите меню: /start')]};
  }
  if (context.action === 'invalid_callback') return {actions: [send('Не удалось определить услугу. Обновите меню: /start')]};
  return {actions: [send('Чтобы увидеть актуальные услуги, отправьте /start.')]};
}
