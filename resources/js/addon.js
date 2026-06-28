(function () {
    'use strict';

    Statamic.booting(() => {
        const { ref, computed, onUnmounted } = window.Vue;

        const BP_FIELD   = { mobile: 'col_w_m', tablet: 'col_w_t', desktop: 'col_w_d' };
        const BP_PREFIX  = { mobile: '', tablet: 'md:', desktop: 'lg:' };
        const BP_DEFAULT = { mobile: 12, tablet: 6, desktop: 4 };

        // ── ColumnItemEditor ─────────────────────────────────────────────────
        // Renders the editing popup for a single column item.
        // Uses vizuall-popup (from statamic-addon/popup) for all popup mechanics.
        // Fields are rendered directly with <component :is> — no FieldsProvider needed.
        const ColumnItemEditor = {
            props: {
                value:  { type: Object, default: () => ({}) },
                meta:   { type: Object, default: () => ({}) },
                config: { type: Object, default: () => ({}) },
                handle: { type: String, default: '' },
            },
            emits: ['update:value', 'update:meta'],

            methods: {
                updateField(fieldHandle, val) {
                    this.$emit('update:value', { ...this.value, [fieldHandle]: val });
                },
                updateFieldMeta(fieldHandle, metaVal) {
                    this.$emit('update:meta', { ...this.meta, [fieldHandle]: metaVal });
                },
                fieldComponent(type) {
                    return (type || 'text').replace(/_/g, '-') + '-fieldtype';
                },
            },

            computed: {
                popupMaxWidth() {
                    return { sm: 420, md: 560, lg: 760 }[this.config.popup_width] || 760;
                },
            },

            template: `
                <vizuall-popup :title="config.display" :max-width="popupMaxWidth">
                    <template #trigger="{ toggle }">
                        <button type="button"
                            class="cb-edit-btn flex items-center justify-center w-8 h-8 rounded-lg border-0 cursor-pointer transition-colors"
                            title="Edit"
                            @click.stop="toggle"
                        >
                            <svg width="13" height="13" viewBox="0 0 16 16" fill="none">
                                <path d="M11.5 1.5a1.5 1.5 0 0 1 2.12 2.12L5 12.24l-2.5.5.5-2.5L11.5 1.5z"
                                      stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
                            </svg>
                        </button>
                    </template>

                    <div v-for="field in (config.fields || [])" :key="field.handle" class="cb-popup-field">
                        <label class="cb-popup-field-label">{{ field.display || field.handle }}</label>
                        <component
                            :is="fieldComponent(field.type)"
                            :value="value[field.handle] ?? null"
                            :meta="meta[field.handle] ?? null"
                            :config="field.config || {}"
                            :handle="field.handle"
                            @update:value="updateField(field.handle, $event)"
                            @update:meta="updateFieldMeta(field.handle, $event)"
                        />
                    </div>
                </vizuall-popup>
            `,
        };

        Statamic.$components.register('column-item-editor', ColumnItemEditor);

        // ── Shared static styles ─────────────────────────────────────────────
        if (!document.getElementById('cb-item-popup-styles')) {
            const s = document.createElement('style');
            s.id = 'cb-item-popup-styles';
            s.textContent = `
                .cb-popup-field{margin-bottom:16px;}
                .cb-popup-field:last-child{margin-bottom:0;}
                .cb-popup-field-label{display:block;font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:.05em;color:rgba(0,0,0,.45);margin-bottom:6px;}
                html.dark .cb-popup-field-label{color:rgba(255,255,255,.4);}
                .vizuall-popup .bard-editor .bard-content{min-height:160px!important;}
                .vizuall-popup .bard-editor .ProseMirror{min-height:160px!important;}
            `;
            document.head.appendChild(s);
        }

        // ── ColumnBuilderFieldtype ───────────────────────────────────────────
        Statamic.$components.register('column-builder-fieldtype', {
            props: {
                value:  { required: true },
                meta:   { type: Object, default: () => ({}) },
                config: { type: Object, default: () => ({}) },
            },
            emits: ['update:value', 'update:meta'],
            setup(props, { emit }) {
                const uid = Math.random().toString(36).slice(2, 8);

                // Per-instance scoped card styles
                const styleEl = document.createElement('style');
                styleEl.textContent = `
                    [data-cbid="${uid}"] .cb-col { background:#18181c; border:1px solid #26262c; }
                    [data-cbid="${uid}"] .cb-col:hover { border-color:#32323c; }
                    [data-cbid="${uid}"] .cb-col-delete { color:#3a3a42; }
                    [data-cbid="${uid}"] .cb-col-delete:hover { color:#f87171; }
                    [data-cbid="${uid}"] .cb-col-plus { color:#2e2e36; }
                    [data-cbid="${uid}"] .cb-col-plus:hover { color:#52525e; }
                    [data-cbid="${uid}"] .cb-width-pill { width:52px; height:22px; border-radius:6px; overflow:hidden; background:#111116; border:1px solid #26262c; }
                    [data-cbid="${uid}"] .cb-width-segments { display:flex; width:100%; height:100%; }
                    [data-cbid="${uid}"] .cb-seg { flex:1; border-left:1px solid #26262c; transition:background .1s; }
                    [data-cbid="${uid}"] .cb-seg:first-child { border-left:none; }
                    [data-cbid="${uid}"] .cb-seg--on { background:#3a3a46; }
                    [data-cbid="${uid}"] .cb-seg:hover { background:#4a4a58; }
                    [data-cbid="${uid}"] .cb-edit-btn { background:#3b5bdb; color:#fff; }
                    [data-cbid="${uid}"] .cb-edit-btn:hover { background:#4c6ef5; }
                    [data-cbid="${uid}"] .cb-add-btn { background:#18181c; color:#6b7280; border:1px dashed #2e2e36; }
                    [data-cbid="${uid}"] .cb-add-btn:hover { color:#d1d5db; border-color:#52525e; }
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

                // ── Add column ────────────────────────────────────────────────
                const addColumn = () => {
                    const newId   = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
                    const newItem = { _id: newId, type: null, enabled: true, col_w_m: 'col-span-12', col_w_t: 'md:col-span-6', col_w_d: 'lg:col-span-4' };
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
                };

                onUnmounted(() => closeTypePicker());

                // ── Width helpers ─────────────────────────────────────────────
                const getWidth = (item, bp) => {
                    const raw = String(item?.[BP_FIELD[bp]] ?? '');
                    const n = parseInt(raw.match(/(\d+)$/)?.[1] ?? raw, 10);
                    return (n > 0 && n <= 12) ? n : (BP_DEFAULT[bp] || 4);
                };

                const getWidthPct = (item, bp) => W_TO_PCT[getWidth(item, bp)] || 100;

                const setWidth = (itemId, w) => {
                    const field  = BP_FIELD[currentBp.value];
                    const prefix = BP_PREFIX[currentBp.value];
                    emit('update:value', items.value.map(item =>
                        item._id === itemId ? { ...item, [field]: prefix + 'col-span-' + w } : item
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
                        const ft = field.type || field.config?.type;
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

                // ── Remove item ───────────────────────────────────────────────
                const removeItem = (itemId) => {
                    emit('update:value', props.value.filter(item => item._id !== itemId));
                    const { [itemId]: _removed, ...restMeta } = (props.meta?.existing || {});
                    emit('update:meta', { ...props.meta, existing: restMeta });
                };

                // ── Editor helpers (value/meta flow to ColumnItemEditor) ───────
                // Strip column-metadata keys so FieldsProvider only sees content fields
                const STRIP_KEYS = new Set(['_id', 'type', 'enabled', 'col_w_m', 'col_w_t', 'col_w_d']);

                const getItemContentValue = (item) => {
                    const content = {};
                    for (const [k, v] of Object.entries(item)) {
                        if (!STRIP_KEYS.has(k)) content[k] = v;
                    }
                    return content;
                };

                const getItemMeta = (item) =>
                    ({ ...(props.meta?.existing?.[item._id] || props.meta?.new?.[item.type] || {}) });

                const getSetFields = (type) =>
                    props.meta?.sets_config?.[type]?.fields || [];

                const typeDisplayLabel = (type) => {
                    const sc = props.meta?.sets_config;
                    if (sc?.[type]?.display) return sc[type].display;
                    for (const group of (props.config?.sets || [])) {
                        const found = (group.sets || []).find(s => s.handle === type);
                        if (found) return found.display ?? type;
                    }
                    return type;
                };

                // Merge updated content fields back, preserving column metadata
                const onEditorValueUpdate = (itemId, newContent) => {
                    emit('update:value', props.value.map(item => {
                        if (item._id !== itemId) return item;
                        return { ...item, ...newContent };
                    }));
                };

                const onEditorMetaUpdate = (itemId, newMeta) => {
                    emit('update:meta', {
                        ...props.meta,
                        existing: { ...(props.meta?.existing || {}), [itemId]: newMeta },
                    });
                };

                const popupWidth = computed(() => props.config.popup_width);

                return {
                    uid,
                    breakpoints, W_PCTS, currentBp, items,
                    addColumn, openTypePicker,
                    getWidth, getWidthPct, setWidthFromPct,
                    hoverState, setHoverPct, clearHoverPct, displayPct,
                    typeDisplayLabel, getItemPreview,
                    getItemContentValue, getItemMeta, getSetFields,
                    onEditorValueUpdate, onEditorMetaUpdate,
                    removeItem, popupWidth,
                };
            },
            template: `
                <div :data-cbid="uid">

                    <!-- GRID -->
                    <div class="rounded-xl overflow-hidden mb-2" style="background:#0d0d10;border:1px solid #1e1e24;">

                        <!-- Breakpoint selector -->
                        <div class="flex items-center px-3 py-2" style="border-bottom:1px solid #1e1e24;">
                            <select
                                v-model="currentBp"
                                class="text-xs px-2 py-1 rounded-md cursor-pointer outline-none transition-colors"
                                style="border:1px solid #2a2a32;background:#18181c;color:#9ca3af;"
                            >
                                <option v-for="bp in breakpoints" :key="bp.handle" :value="bp.handle">{{ bp.label }}</option>
                            </select>
                        </div>

                        <!-- Grid canvas -->
                        <div class="p-3 min-h-35">
                            <div v-if="items.length > 0" class="grid grid-cols-12 gap-2">
                                <div
                                    v-for="item in items"
                                    :key="item._id"
                                    :style="{ gridColumn: 'span ' + getWidth(item, currentBp) }"
                                    class="cb-col relative flex flex-col rounded-xl transition-all min-h-36"
                                >
                                    <!-- Delete -->
                                    <button
                                        type="button"
                                        @click.stop="removeItem(item._id)"
                                        class="cb-col-delete absolute top-2 right-2 z-10 w-5 h-5 flex items-center justify-center rounded-full border-0 bg-transparent transition-colors cursor-pointer text-sm leading-none p-0"
                                        title="Delete column"
                                    >×</button>

                                    <!-- Empty: pick type -->
                                    <div
                                        v-if="!item.type"
                                        @click.stop="openTypePicker(item._id, $event.currentTarget)"
                                        class="flex-1 flex items-center justify-center cursor-pointer transition-colors cb-col-plus"
                                        title="Choose column type"
                                    >
                                        <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor">
                                            <path d="M10.75 2v7.25H18v1.5h-7.25V18h-1.5v-7.25H2v-1.5h7.25V2z"/>
                                        </svg>
                                    </div>

                                    <!-- Filled: preview -->
                                    <div v-else class="flex-1 px-4 pt-4 pb-3 flex flex-col gap-1.5">
                                        <span class="text-sm font-semibold truncate pr-5 leading-tight" style="color:#e5e7eb;">
                                            {{ typeDisplayLabel(item.type) }}
                                        </span>
                                        <span
                                            v-if="getItemPreview(item)"
                                            class="text-xs leading-snug line-clamp-2"
                                            style="color:#6b7280;"
                                        >{{ getItemPreview(item).text }}</span>
                                    </div>

                                    <!-- Bottom: width pill + editor -->
                                    <div class="flex items-center justify-between px-3 pb-3 pt-1" @click.stop>

                                        <!-- Width pill -->
                                        <div
                                            class="cb-width-pill relative cursor-pointer font-mono text-[10px]"
                                            @mouseleave.stop="clearHoverPct()"
                                        >
                                            <div class="cb-width-segments flex">
                                                <div
                                                    v-for="pct in W_PCTS"
                                                    :key="pct"
                                                    :class="['cb-seg', displayPct(item) >= pct ? 'cb-seg--on' : '']"
                                                    @mouseenter.stop="setHoverPct(item._id, pct)"
                                                    @click.stop="setWidthFromPct(item._id, pct)"
                                                />
                                            </div>
                                            <div class="pointer-events-none absolute inset-0 flex items-center justify-center font-medium" style="color:#d1d5db;">
                                                {{ displayPct(item) }}%
                                            </div>
                                        </div>

                                        <!-- Editor popup (pencil button + teleport popup) -->
                                        <column-item-editor
                                            v-if="item.type"
                                            :value="getItemContentValue(item)"
                                            :meta="getItemMeta(item)"
                                            :config="{ display: typeDisplayLabel(item.type), fields: getSetFields(item.type), popup_width: popupWidth }"
                                            :handle="item._id"
                                            @update:value="onEditorValueUpdate(item._id, $event)"
                                            @update:meta="onEditorMetaUpdate(item._id, $event)"
                                        />
                                    </div>
                                </div>
                            </div>

                            <!-- Empty state -->
                            <div v-else class="h-27.5 flex items-center justify-center">
                                <span class="text-xs" style="color:#3a3a42;">Add a column to get started</span>
                            </div>
                        </div>
                    </div>

                    <!-- ADD COLUMN -->
                    <button
                        type="button"
                        @click="addColumn"
                        class="inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg transition-colors cursor-pointer border-0 cb-add-btn"
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
