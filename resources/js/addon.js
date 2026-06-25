(function () {
    'use strict';

    Statamic.booting(() => {
        const { ref, computed, watch, nextTick, onUnmounted } = window.Vue;

        const BP_FIELD   = { mobile: 'col_w_m', tablet: 'col_w_t', desktop: 'col_w_d' };
        const BP_DEFAULT = { mobile: 12, tablet: 6, desktop: 4 };

        Statamic.$components.register('column-builder-fieldtype', {
            props: {
                value:  { required: true },
                meta:   { type: Object, default: () => ({}) },
                config: { type: Object, default: () => ({}) },
            },
            emits: ['update:value', 'update:meta'],
            setup(props, { emit }) {
                const uid        = Math.random().toString(36).slice(2, 8);
                const portalName = 'cb-ed-' + uid;
                const popupClass = 'cb-popup-' + uid;

                const styleEl = document.createElement('style');
                styleEl.textContent = `
                    .${popupClass} .bard-editor { min-height:280px !important; height:280px !important; display:flex !important; flex-direction:column !important; }
                    .${popupClass} .bard-editor > div { flex:1 !important; min-height:0 !important; display:flex !important; flex-direction:column !important; }
                    .${popupClass} .bard-editor .ProseMirror { flex:1 !important; min-height:200px !important; overflow-y:auto !important; }
                    .${popupClass} .bard-editor .bard-content { min-height:200px !important; }
                `;
                document.head.appendChild(styleEl);
                onUnmounted(() => document.head.removeChild(styleEl));

                const W_PCTS   = [25, 33, 50, 67, 75, 100];
                const W_TO_PCT = { 3: 25, 4: 33, 6: 50, 8: 67, 9: 75, 12: 100 };
                const PCT_TO_W = { 25: 3, 33: 4, 50: 6, 67: 8, 75: 9, 100: 12 };

                const breakpoints = computed(() => props.meta?.breakpoints || []);
                const currentBp   = ref('desktop');
                const items       = computed(() => Array.isArray(props.value) ? props.value : []);

                // ── Column type sets ──────────────────────────────────────────
                // Loops through all groups and collects their sets, so every
                // field group defined in the blueprint appears in the type picker.
                const columnSets = computed(() => {
                    const sc = props.meta?.sets_config;
                    if (sc && Object.keys(sc).length > 0) {
                        return Object.entries(sc).map(([handle, cfg]) => ({
                            handle,
                            display: cfg.display || handle,
                        }));
                    }
                    const result = [];
                    (props.config?.sets || []).forEach(group => {
                        (group?.sets || []).forEach(s => {
                            result.push({ handle: s.handle, display: s.display ?? s.handle });
                        });
                    });
                    return result;
                });

                // ── Add empty column ──────────────────────────────────────────
                const addColumn = () => {
                    const newId   = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
                    const newItem = { _id: newId, type: null, enabled: true, col_w_m: '12', col_w_t: '6', col_w_d: '4' };
                    emit('update:value', [...items.value, newItem]);
                };

                // ── Type picker portal ────────────────────────────────────────
                const typePickerPortal  = { value: null };
                const typePickerItemId  = ref(null);
                let   typePickerTrigger = null;

                const updateTypePickerPos = () => {
                    if (!typePickerPortal.value || !typePickerTrigger) return;
                    const r    = typePickerTrigger.getBoundingClientRect();
                    const left = Math.max(8, r.left + r.width / 2 - 90);
                    typePickerPortal.value.style.top  = `${r.bottom + 6}px`;
                    typePickerPortal.value.style.left = `${left}px`;
                };

                const handleClickOutsideTypePicker = (e) => {
                    if (!typePickerPortal.value) return;
                    if (!typePickerPortal.value.contains(e.target)) closeTypePicker();
                };

                const closeTypePicker = () => {
                    if (!typePickerPortal.value) return;
                    document.body.removeChild(typePickerPortal.value);
                    typePickerPortal.value = null;
                    typePickerItemId.value = null;
                    typePickerTrigger      = null;
                    document.removeEventListener('click', handleClickOutsideTypePicker, true);
                    window.removeEventListener('scroll', updateTypePickerPos, true);
                };

                const openTypePicker = (itemId, triggerEl) => {
                    if (typePickerPortal.value) { closeTypePicker(); return; }

                    typePickerItemId.value = itemId;
                    typePickerTrigger      = triggerEl;

                    const r      = triggerEl.getBoundingClientRect();
                    const left   = Math.max(8, r.left + r.width / 2 - 90);
                    const isDark = document.documentElement.classList.contains('dark');
                    const bg     = isDark ? '#1f2937' : '#ffffff';
                    const hover  = isDark ? '#374151' : '#f3f4f6';
                    const text   = isDark ? '#d1d5db' : '#111827';
                    const border = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.10)';
                    const shadow = isDark ? '0 4px 16px rgba(0,0,0,0.4)' : '0 4px 16px rgba(0,0,0,0.12)';

                    const div = document.createElement('div');
                    div.style.cssText = `position:fixed;z-index:99999;top:${r.bottom + 6}px;left:${left}px;background:${bg};border-radius:6px;border:1px solid ${border};box-shadow:${shadow};min-width:180px;overflow:hidden;`;

                    columnSets.value.forEach(({ handle, display }) => {
                        const btn = document.createElement('button');
                        btn.type        = 'button';
                        btn.textContent = display;
                        btn.style.cssText = `display:block;width:100%;text-align:left;padding:10px 16px;background:none;border:none;color:${text};cursor:pointer;font-size:13px;`;
                        btn.addEventListener('mouseenter', () => { btn.style.background = hover; });
                        btn.addEventListener('mouseleave', () => { btn.style.background = 'none'; });
                        btn.addEventListener('click', () => setColumnType(itemId, handle));
                        div.appendChild(btn);
                    });

                    document.body.appendChild(div);
                    typePickerPortal.value = div;
                    document.addEventListener('click', handleClickOutsideTypePicker, true);
                    window.addEventListener('scroll', updateTypePickerPos, true);
                };

                const setColumnType = (itemId, handle) => {
                    closeTypePicker();
                    const setMeta      = (props.meta?.new || {})[handle] || { _: '_' };
                    const updatedItems = items.value.map(item =>
                        item._id === itemId ? { ...item, type: handle } : item
                    );
                    emit('update:value', updatedItems);
                    emit('update:meta', {
                        ...props.meta,
                        existing: { ...(props.meta?.existing || {}), [itemId]: setMeta },
                    });
                    const updatedItem = updatedItems.find(i => i._id === itemId);
                    if (updatedItem) nextTick(() => openEditor(updatedItem));
                };

                onUnmounted(() => closeTypePicker());

                // ── Width helpers ─────────────────────────────────────────────
                const getWidth = (item, bp) => {
                    const n = parseInt(item?.[BP_FIELD[bp]], 10);
                    return (n > 0 && n <= 12) ? n : (BP_DEFAULT[bp] || 4);
                };

                const getWidthPct = (item, bp) => W_TO_PCT[getWidth(item, bp)] || 100;

                const setWidth = (itemId, w) => {
                    const field = BP_FIELD[currentBp.value];
                    emit('update:value', items.value.map(item =>
                        item._id === itemId ? { ...item, [field]: String(w) } : item
                    ));
                };

                const setWidthFromPct = (itemId, pct) => setWidth(itemId, PCT_TO_W[pct] || 12);

                const hoverState    = ref({ id: null, pct: null });
                const setHoverPct   = (id, pct) => { hoverState.value = { id, pct }; };
                const clearHoverPct = ()         => { hoverState.value = { id: null, pct: null }; };
                const displayPct    = (item)     => hoverState.value.id === item._id
                    ? hoverState.value.pct
                    : getWidthPct(item, currentBp.value);

                // ── Preview helpers ───────────────────────────────────────────
                const bardToText = (nodes) => {
                    if (!Array.isArray(nodes)) return '';
                    const parts = [];
                    const walk = (list) => {
                        for (const n of list) {
                            if (n.type === 'text' && n.text) parts.push(n.text);
                            if (n.content) walk(n.content);
                            if (parts.join('').length > 80) return;
                        }
                    };
                    walk(nodes);
                    const t = parts.join('').trim();
                    return t.length > 60 ? t.slice(0, 60) + '…' : t;
                };

                const getItemPreview = (item) => {
                    const fields = props.meta?.sets_config?.[item.type]?.fields || [];
                    for (const field of fields) {
                        const val = item[field.handle];
                        if (val === undefined || val === null || val === '') continue;
                        const ft = field.config?.type;
                        if (ft === 'assets') {
                            const arr = Array.isArray(val) ? val : [val];
                            if (arr.length > 0) {
                                const name = String(arr[0]).split('/').pop();
                                return { kind: 'file', text: name || `${arr.length} file` };
                            }
                        }
                        if (ft === 'bard' && Array.isArray(val)) {
                            const t = bardToText(val);
                            if (t) return { kind: 'text', text: t };
                        }
                        if ((ft === 'text' || ft === 'textarea') && typeof val === 'string' && val.trim()) {
                            const t = val.trim();
                            return { kind: 'text', text: t.length > 60 ? t.slice(0, 60) + '…' : t };
                        }
                        if (ft === 'link' || field.handle === 'links') {
                            if (Array.isArray(val))
                                return { kind: 'text', text: `${val.length} link${val.length !== 1 ? 's' : ''}` };
                        }
                    }
                    return null;
                };

                // ── Popup (field editor) ──────────────────────────────────────
                const popupStyle = ref('');
                const calcPopupStyle = () => {
                    const lp = document.querySelector('.live-preview-editor');
                    if (lp) {
                        const r = lp.getBoundingClientRect();
                        popupStyle.value = `position:fixed;top:${r.top}px;left:${r.left}px;width:${r.width}px;height:${r.height}px;z-index:9000;display:flex;align-items:flex-start;justify-content:center;overflow-y:auto;padding:40px 16px;`;
                    } else {
                        popupStyle.value = 'position:fixed;inset:0;z-index:9000;display:flex;align-items:flex-start;justify-content:center;overflow-y:auto;padding:48px 20px;';
                    }
                };

                const typeDisplayLabel = (type) => {
                    const sc = props.meta?.sets_config;
                    if (sc?.[type]?.display) return sc[type].display;
                    for (const group of (props.config?.sets || [])) {
                        const found = (group.sets || []).find(s => s.handle === type);
                        if (found) return found.display ?? type;
                    }
                    return type;
                };

                const editingId     = ref(null);
                const editingValues = ref({});
                const editingMeta   = ref({});

                const editingItem = computed(() =>
                    editingId.value ? items.value.find(i => i._id === editingId.value) : null
                );

                const editingSetLabel = computed(() =>
                    editingItem.value ? typeDisplayLabel(editingItem.value.type) : ''
                );

                const editingSetFields = computed(() => {
                    const type = editingItem.value?.type;
                    if (!type) return [];
                    return props.meta?.sets_config?.[type]?.fields || [];
                });

                watch(editingItem, (item) => {
                    if (!item && editingId.value) closeEditor();
                });

                // Track known IDs — no auto-open; setColumnType handles opening
                // the editor after a type is selected on a fresh empty column.
                const knownIds = new Set(items.value.map(i => i._id));
                watch(items, (newItems) => {
                    newItems.forEach(item => { knownIds.add(item._id); });
                });

                const openEditor = (item) => {
                    if (!item.type) return;
                    calcPopupStyle();
                    editingId.value     = item._id;
                    editingValues.value = { ...item };
                    editingMeta.value   = {
                        ...(props.meta?.existing?.[item._id] || props.meta?.new?.[item.type] || {}),
                    };
                };

                const closeEditor = () => {
                    editingId.value     = null;
                    editingValues.value = {};
                    editingMeta.value   = {};
                };

                const updateFieldValue = (handle, val) => {
                    const next = { ...editingValues.value, [handle]: val };
                    editingValues.value = next;
                    emit('update:value', props.value.map(item =>
                        item._id === editingId.value ? { ...next } : item
                    ));
                };

                const updateFieldMeta = (handle, metaVal) => {
                    const nextMeta = { ...editingMeta.value, [handle]: metaVal };
                    editingMeta.value = nextMeta;
                    emit('update:meta', {
                        ...props.meta,
                        existing: { ...(props.meta?.existing || {}), [editingId.value]: nextMeta },
                    });
                };

                const removeItem = (itemId) => {
                    if (editingId.value === itemId) closeEditor();
                    emit('update:value', props.value.filter(item => item._id !== itemId));
                    const { [itemId]: _removed, ...restMeta } = (props.meta?.existing || {});
                    emit('update:meta', { ...props.meta, existing: restMeta });
                };

                const BARD_META_FALLBACK = {
                    existing: [], new: null, defaults: null, collapsed: [],
                    previews: [], linkCollections: [], linkData: {},
                    '__collaboration': ['existing'],
                };

                const resolveFieldMeta = (field) => {
                    const meta = editingMeta.value[field.handle];
                    if (field.config?.type === 'bard') {
                        if (meta == null || !Object.prototype.hasOwnProperty.call(meta, 'collapsed')) {
                            return BARD_META_FALLBACK;
                        }
                    }
                    return meta !== undefined ? meta : null;
                };

                const resolveFieldValue = (field) => {
                    const val = editingValues.value[field.handle];
                    if (field.config?.type === 'bard' && (val === undefined || val === null)) {
                        return [];
                    }
                    return val !== undefined ? val : null;
                };

                const resolveFieldConfig = (field) => {
                    if (field.config?.type === 'bard') {
                        return { sets: [], ...field.config };
                    }
                    return field.config;
                };

                return {
                    uid, portalName, popupClass, popupStyle,
                    breakpoints, W_PCTS, currentBp, items,
                    addColumn, openTypePicker,
                    getWidth, getWidthPct, setWidthFromPct,
                    hoverState, setHoverPct, clearHoverPct, displayPct,
                    typeDisplayLabel, getItemPreview,
                    editingId, editingValues, editingMeta,
                    editingItem, editingSetLabel, editingSetFields,
                    openEditor, closeEditor, updateFieldValue, updateFieldMeta,
                    removeItem, resolveFieldMeta, resolveFieldValue, resolveFieldConfig,
                };
            },
            template: `
                <div :data-cbid="uid">

                    <!-- ════════════════════════════════
                         POPUP (field editor)
                         ════════════════════════════════ -->
                    <portal :name="portalName">
                        <div
                            v-if="editingId"
                            :class="popupClass"
                            :style="popupStyle + 'background:rgba(0,0,0,0.55);'"
                            @click.self="closeEditor"
                        >
                            <div class="w-full max-w-2xl rounded-xl overflow-hidden shadow-2xl border border-gray-700 bg-gray-800">

                                <!-- Header -->
                                <div class="flex items-center justify-between px-5 py-4 border-b border-gray-700">
                                    <span class="text-sm font-semibold text-gray-100">{{ editingSetLabel }}</span>
                                    <button type="button" @click="closeEditor"
                                        class="text-gray-500 hover:text-gray-300 transition-colors text-2xl leading-none px-1 bg-transparent border-0 cursor-pointer">×</button>
                                </div>

                                <!-- Fields -->
                                <div class="p-6 space-y-6">
                                    <div v-if="!editingSetFields.length"
                                         class="text-center text-sm text-gray-500 py-4">No fields</div>

                                    <div v-for="field in editingSetFields" :key="field.handle">
                                        <label class="block text-xs font-semibold uppercase tracking-widest text-gray-500 mb-2">
                                            {{ field.display || field.handle }}
                                        </label>
                                        <component
                                            :is="(field.config.type || 'text') + '-fieldtype'"
                                            :value="resolveFieldValue(field)"
                                            :meta="resolveFieldMeta(field)"
                                            :config="resolveFieldConfig(field)"
                                            :handle="field.handle"
                                            @update:value="updateFieldValue(field.handle, $event)"
                                            @update:meta="updateFieldMeta(field.handle, $event)"
                                        />
                                    </div>
                                </div>

                                <!-- Footer -->
                                <div class="flex justify-end px-5 py-3 border-t border-gray-700">
                                    <button type="button" @click="closeEditor"
                                        class="px-5 py-2 bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium rounded-lg border-0 cursor-pointer transition-colors">
                                        Done
                                    </button>
                                </div>
                            </div>
                        </div>
                    </portal>

                    <!-- ════════════════════════════════
                         GRID
                         ════════════════════════════════ -->
                    <div class="rounded-lg border border-gray-700/60 overflow-hidden mb-1.5">

                        <!-- Breakpoint selector -->
                        <div class="flex items-center px-3 py-2 bg-gray-800/40 border-b border-gray-700/40">
                            <select
                                v-model="currentBp"
                                class="text-xs px-2 py-1 rounded-md border border-gray-700 bg-gray-800 text-gray-300 cursor-pointer outline-none focus:border-blue-500 transition-colors"
                            >
                                <option v-for="bp in breakpoints" :key="bp.handle" :value="bp.handle">{{ bp.label }}</option>
                            </select>
                        </div>

                        <!-- Grid canvas -->
                        <div class="p-3 bg-gray-900/30 min-h-35">

                            <div v-if="items.length > 0" class="grid grid-cols-12 gap-2">
                                <div
                                    v-for="item in items"
                                    :key="item._id"
                                    :style="{ gridColumn: 'span ' + getWidth(item, currentBp) }"
                                    :class="[
                                        'relative flex flex-col rounded-md border transition-colors min-h-30',
                                        editingId === item._id
                                            ? 'border-blue-500/40 bg-blue-950/20'
                                            : 'border-gray-700/70 bg-gray-800/50 hover:border-gray-600'
                                    ]"
                                >
                                    <!-- × Delete -->
                                    <button
                                        type="button"
                                        @click.stop="removeItem(item._id)"
                                        class="absolute top-1.5 right-1.5 z-10 w-4 h-4 flex items-center justify-center rounded-full border-0 bg-transparent text-red-400/40 hover:text-red-400 transition-colors cursor-pointer text-sm leading-none p-0"
                                        title="Delete column"
                                    >×</button>

                                    <!-- Empty column: click + to pick type -->
                                    <div
                                        v-if="!item.type"
                                        @click.stop="openTypePicker(item._id, $event.currentTarget)"
                                        class="flex-1 flex items-center justify-center cursor-pointer text-gray-600 hover:text-gray-400 transition-colors"
                                        title="Choose column type"
                                    >
                                        <svg width="22" height="22" viewBox="0 0 22 22" fill="currentColor">
                                            <path d="M11.5 3v7.5H19v1h-7.5V19h-1v-7.5H3v-1h7.5V3z"/>
                                        </svg>
                                    </div>

                                    <!-- Filled column: click to edit -->
                                    <div
                                        v-else
                                        @click.stop="openEditor(item)"
                                        class="flex-1 px-3 pt-3 pb-2 cursor-pointer flex flex-col gap-1"
                                    >
                                        <span class="text-xs font-semibold text-gray-200 truncate pr-4 leading-tight">
                                            {{ typeDisplayLabel(item.type) }}
                                        </span>
                                        <span
                                            v-if="getItemPreview(item)"
                                            class="text-[11px] text-gray-500 leading-snug line-clamp-2"
                                        >{{ getItemPreview(item).text }}</span>
                                    </div>

                                    <!-- Bottom: width selector + edit button -->
                                    <div class="flex items-center justify-between px-2.5 py-2 border-t border-gray-700/40" @click.stop>

                                        <div
                                            class="relative flex h-6 w-14 cursor-pointer overflow-hidden rounded border border-gray-700 bg-gray-800 font-mono text-[10px] antialiased"
                                            @mouseleave.stop="clearHoverPct()"
                                        >
                                            <div class="flex w-full">
                                                <div
                                                    v-for="pct in W_PCTS"
                                                    :key="pct"
                                                    :class="[
                                                        'flex-1 border-l border-gray-700/60 first:border-l-0 transition-colors',
                                                        displayPct(item) >= pct ? 'bg-gray-600' : ''
                                                    ]"
                                                    @mouseenter.stop="setHoverPct(item._id, pct)"
                                                    @click.stop="setWidthFromPct(item._id, pct)"
                                                />
                                            </div>
                                            <div class="pointer-events-none absolute inset-0 z-10 flex items-center justify-center font-medium text-gray-200">
                                                {{ displayPct(item) }}%
                                            </div>
                                        </div>

                                        <!-- Edit button (only when type is set) -->
                                        <button
                                            v-if="item.type"
                                            type="button"
                                            @click.stop="openEditor(item)"
                                            class="flex items-center justify-center w-6 h-6 rounded border border-gray-700 bg-transparent text-gray-400 hover:text-gray-200 hover:border-gray-500 transition-colors cursor-pointer"
                                            title="Edit"
                                        >
                                            <svg width="11" height="11" viewBox="0 0 16 16" fill="none">
                                                <path d="M11.5 1.5a1.5 1.5 0 0 1 2.12 2.12L5 12.24l-2.5.5.5-2.5L11.5 1.5z"
                                                      stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
                                            </svg>
                                        </button>
                                    </div>
                                </div>
                            </div>

                            <!-- Empty state -->
                            <div v-else class="h-27.5 flex items-center justify-center">
                                <span class="text-xs text-gray-600">Add a column to get started</span>
                            </div>
                        </div>
                    </div>

                    <!-- ADD COLUMN BUTTON -->
                    <button
                        type="button"
                        @click="addColumn"
                        class="inline-flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-300 border border-dashed border-gray-600/60 hover:border-gray-500/60 px-3 py-1.5 rounded-md transition-colors cursor-pointer bg-transparent"
                    >
                        <svg width="10" height="10" viewBox="0 0 10 10" fill="currentColor">
                            <path d="M5.5 1v3.5H9v1H5.5V9h-1V5.5H1v-1h3.5V1z"/>
                        </svg>
                        Add column
                    </button>

                </div>
            `,
        });
    });
}());
