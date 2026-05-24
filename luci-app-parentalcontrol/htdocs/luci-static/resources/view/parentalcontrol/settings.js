'use strict';
'require view';
'require rpc';
'require ui';
'require poll';

let callGetStatus    = rpc.declare({ object: 'parentalcontrol', method: 'get_status',    expect: {} });
let callListDevices  = rpc.declare({ object: 'parentalcontrol', method: 'list_devices',  expect: {} });
let callToggleGlobal = rpc.declare({ object: 'parentalcontrol', method: 'toggle_global', params: ['enabled'] });
let callToggleRule   = rpc.declare({ object: 'parentalcontrol', method: 'toggle_rule',   params: ['section', 'enabled'] });
let callSetOverride  = rpc.declare({ object: 'parentalcontrol', method: 'set_override',  params: ['section', 'minutes'] });
let callCancelOverride = rpc.declare({ object: 'parentalcontrol', method: 'cancel_override', params: ['section'] });
let callAddRule      = rpc.declare({ object: 'parentalcontrol', method: 'add_rule',      params: ['name', 'mac', 'schedules', 'enabled'] });
let callUpdateRule   = rpc.declare({ object: 'parentalcontrol', method: 'update_rule',   params: ['section', 'name', 'schedules', 'enabled'] });
let callDeleteRule   = rpc.declare({ object: 'parentalcontrol', method: 'delete_rule',   params: ['section'] });
let callMoveRule     = rpc.declare({ object: 'parentalcontrol', method: 'move_rule',     params: ['section', 'direction'] });
let callReorderRule  = rpc.declare({ object: 'parentalcontrol', method: 'reorder_rule',  params: ['section', 'position'] });

const DAY_NAMES  = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];
const DAY_LABELS = [_('Mon'), _('Tue'), _('Wed'), _('Thu'), _('Fri'), _('Sat'), _('Sun')];

let CSS = '\
.pc-header { display:flex; align-items:center; gap:12px; padding:12px 16px; border:1px solid rgba(255,255,255,0.08); border-radius:6px; margin-bottom:20px; }\
.pc-header-label { font-weight:600; font-size:15px; }\
.pc-header-status { font-size:13px; font-weight:600; }\
.pc-mac { font-family:monospace; font-size:12px; opacity:0.5; }\
.pc-sched-line { display:block; font-size:13px; line-height:1.6; }\
:root {\
  --pc-badge-blocked-bg: #ef5350;\
  --pc-badge-override-bg: #ff9800;\
  --pc-badge-inactive-bg: #546e7a;\
  --pc-badge-scheduled-bg: #1565c0;\
  --pc-badge-text: #ffffff;\
  --pc-badge-shadow: 0 1px 2px rgba(0,0,0,.4), 0 2px 6px rgba(0,0,0,.25);\
  --pc-badge-border-blocked: transparent;\
  --pc-badge-border-override: transparent;\
  --pc-badge-border-inactive: transparent;\
  --pc-badge-border-scheduled: transparent;\
}\
:root[data-darkmode="true"] {\
  --pc-badge-blocked-bg: rgba(239,83,80,0.28);\
  --pc-badge-override-bg: rgba(255,152,0,0.28);\
  --pc-badge-inactive-bg: rgba(84,110,122,0.28);\
  --pc-badge-scheduled-bg: rgba(21,101,192,0.28);\
  --pc-badge-text: #e5e7eb;\
  --pc-badge-shadow: 0 1px 2px rgba(0,0,0,.35), 0 2px 6px rgba(0,0,0,.22);\
  --pc-badge-border-blocked: rgba(239,83,80,0.6);\
  --pc-badge-border-override: rgba(255,152,0,0.6);\
  --pc-badge-border-inactive: rgba(255,255,255,0.3);\
  --pc-badge-border-scheduled: rgba(21,101,192,0.6);\
}\
.pc-badge {\
  display:inline-block;\
  padding:4px 10px;\
  border-radius:4px;\
  color:var(--pc-badge-text);\
  font-size:13px;\
  font-weight:500;\
  white-space:nowrap;\
  text-align:center;\
  min-width:110px;\
  border:1px solid transparent;\
  text-shadow:var(--pc-badge-shadow);\
}\
.pc-badge-blocked   { background:var(--pc-badge-blocked-bg);   border-color:var(--pc-badge-border-blocked);   }\
.pc-badge-override  { background:var(--pc-badge-override-bg);  border-color:var(--pc-badge-border-override);  }\
.pc-badge-inactive  { background:var(--pc-badge-inactive-bg);  border-color:var(--pc-badge-border-inactive);  }\
.pc-badge-scheduled { background:var(--pc-badge-scheduled-bg); border-color:var(--pc-badge-border-scheduled); }\
.pc-actions { display:flex; gap:4px; align-items:center; }\
.pc-override-cell { display:flex; flex-direction:row; gap:6px; align-items:center; flex-wrap:wrap; }\
.pc-override-info { font-size:13px; color:#ff9800; font-weight:600; }\
.pc-section-title { font-size:16px; font-weight:600; margin:20px 0 10px; }\
.pc-modal-error { margin:0 0 16px; padding:12px 14px; background:#d32f2f; color:white; border-radius:4px; font-size:13px; font-weight:500; }\
\
\
\
.pc-device-row { display:flex; gap:10px; align-items:center; flex-wrap:wrap; }\
.pc-device-row select { flex:1 1 250px; min-width:0; }\
.pc-device-row input { flex:0 0 160px; }\
\
.pc-sched-block { padding:12px; border:1px solid rgba(255,255,255,0.08); border-radius:4px; margin-bottom:8px; }\
.pc-sched-block-header { display:flex; align-items:center; justify-content:space-between; margin-bottom:8px; }\
.pc-sched-block-title { font-size:12px; font-weight:600; opacity:0.4; text-transform:uppercase; letter-spacing:0.5px; }\
.pc-day-checks { display:none; gap:4px; }\
.cbi-modal .pc-day-checks { display:flex; }\
.pc-day-btn { padding:4px 2px; border:1px solid var(--border-color-medium); border-radius:3px; background:rgba(255,255,255,0.04); cursor:pointer; font-size:11px; user-select:none; transition:all 0.15s; flex:1; text-align:center; }\
.pc-day-btn.active { background:#1565c0; border-color:#1565c0; color:#fff; }\
.pc-day-btn:hover { background:rgba(255,255,255,0.08); }\
.pc-day-btn.active:hover { background:#1565c0; border-color:#1565c0; }\
\
.pc-time-row { display:flex; align-items:center; gap:8px; margin-top:8px; }\
.pc-time-label { font-size:12px; opacity:0.5; font-weight:600; }\
.pc-time-input { width:120px; }\
\
.pc-drag-handle { cursor:grab; opacity:0.4; font-size:16px; user-select:none; display:flex; flex-direction:column; align-items:center; gap:2px; }\
.pc-drag-handle:hover { opacity:0.8; }\
.pc-drag-handle:active { cursor:grabbing; }\
.pc-table .tr[draggable="true"]:hover .pc-drag-handle { opacity:0.7; }\
.pc-table .tr.pc-drag-over { border-top:3px solid #42a5f5 !important; margin-top:-1px; }\
.pc-table .tr.pc-drag-over-below { border-bottom:3px solid #42a5f5 !important; margin-bottom:-1px; }\
.pc-table .tr.pc-dragging { opacity:0.3; }\
.pc-reorder-cell { display:flex; flex-direction:column; align-items:center; gap:2px; }\
.pc-btn-arrow { padding:1px 4px; font-size:10px; line-height:1; min-width:20px; text-align:center; border:1px solid rgba(255,255,255,0.1); border-radius:2px; background:rgba(255,255,255,0.04); cursor:pointer; opacity:0.4; }\
.pc-btn-arrow:hover { opacity:0.8; background:rgba(255,255,255,0.1); }\
.pc-btn-arrow[disabled] { opacity:0.1; cursor:default; pointer-events:none; }\
.pc-stats { font-size:12px; line-height:1.5; }\
.pc-stats-packets { font-weight:600; }\
.pc-stats-bytes { opacity:0.5; }\
\
@media screen and (max-device-width: 600px) {\
  .pc-header { flex-wrap:wrap; gap:8px; padding:10px 12px; }\
  .pc-modal { width:95vw; max-height:90vh; }\
  .pc-modal-body { padding:14px; }\
  .pc-modal-header { padding:12px 14px; }\
  .pc-modal-footer { padding:12px 14px; }\
  .pc-modal-title { font-size:14px; }\
  .pc-device-row { flex-direction:column; align-items:stretch; }\
  .pc-device-row select { flex:1 1 auto !important; width:100%; }\
  .pc-device-row input { flex:1 1 auto !important; width:100% !important; }\
  .pc-time-row { flex-wrap:wrap; }\
  .pc-time-input { width:100px; }\
    .pc-table .tr .td.pc-reorder-td { flex:0 0 30px !important; display:flex !important; align-items:center; justify-content:center; }\
  .pc-table .tr .td.pc-reorder-td .pc-btn-arrow { display:none; }\
  .pc-drag-handle { font-size:20px; touch-action:none; }\
  .pc-table .tr { padding:4px 6px; margin-bottom:4px; }\
  .pc-table .tr .td[data-title=_("Device")] { flex:1 1 calc(100% - 40px); }\
  .pc-table .tr .td[data-title=_("Schedule")] { flex:1 1 50%; }\
  .pc-table .tr .td[data-title=_("Status")] { flex:1 1 50%; }\
  .pc-table .tr .td[data-title=_("Blocked")]:not(.pc-stats-empty) { flex:1 1 100%; }\
  .pc-table .tr .td[data-title=_("Enabled")] { flex:1 1 50%; text-align:left !important; }\
  .pc-table .tr .td[data-title=_("Bonus Time")] { flex:1 1 50%; }\
  .pc-table .tr .td[data-title=_("Blocked")].pc-stats-empty { display:none; }\
  .pc-table .tr .td.cbi-section-actions { border-top:none !important; }\
  .pc-actions { justify-content:stretch; gap:8px; }\
  }\
';

function addPcDarkModeStyles() {
	const style = document.createElement('style');
	style.type = 'text/css';
	style.textContent = `
		:root {
			--pc-badge-blocked-bg:    #ef5350;
			--pc-badge-override-bg:   #ff9800;
			--pc-badge-inactive-bg:   #546e7a;
			--pc-badge-scheduled-bg:  #1565c0;
			--pc-badge-text:          #ffffff;
			--pc-badge-shadow:        0 1px 2px rgba(0,0,0,.4), 0 2px 6px rgba(0,0,0,.25);
			--pc-badge-border-blocked:    transparent;
			--pc-badge-border-override:   transparent;
			--pc-badge-border-inactive:   transparent;
			--pc-badge-border-scheduled:  transparent;
		}
		:root[data-darkmode="true"] {
			--pc-badge-blocked-bg:    rgba(239,83,80,0.28);
			--pc-badge-override-bg:   rgba(255,152,0,0.28);
			--pc-badge-inactive-bg:   rgba(84,110,122,0.28);
			--pc-badge-scheduled-bg:  rgba(21,101,192,0.28);
			--pc-badge-text:          #e5e7eb;
			--pc-badge-shadow:        0 1px 2px rgba(0,0,0,.35), 0 2px 6px rgba(0,0,0,.22);
			--pc-badge-border-blocked:    rgba(239,83,80,0.6);
			--pc-badge-border-override:   rgba(255,152,0,0.6);
			--pc-badge-border-inactive:   rgba(255,255,255,0.3);
			--pc-badge-border-scheduled:  rgba(21,101,192,0.6);
		}
	`;
	document.head.appendChild(style);
}

function popTimeout(a, message, timeout, severity) {
	ui.addTimeLimitedNotification(a, message, timeout, severity);
}

function formatDuration(seconds) {
	if (seconds <= 0) return '';
	let h = Math.floor(seconds / 3600);
	let m = Math.floor((seconds % 3600) / 60);
	if (h > 0 && m > 0) return h + _('h') + ' ' + m + _('m');
	if (h > 0) return h + _('h');
	return m + _('m');
}

function formatBytes(bytes) {
	if (bytes === 0) return '0 ' + _('B');
	let units = [_('B'), _('KB'), _('MB'), _('GB')];
	let i = 0;
	while (bytes >= 1024 && i < units.length - 1) { bytes /= 1024; i++; }
	return (i === 0 ? bytes : bytes.toFixed(1)) + ' ' + units[i];
}

function formatPackets(packets) {
	if (packets >= 1000000) return (packets / 1000000).toFixed(1) + _('M');
	if (packets >= 1000) return (packets / 1000).toFixed(1) + _('K');
	return packets.toString();
}

function compactDays(dayList) {
	const order  = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];
	const labels = { mon: _('Mon'), tue: _('Tue'), wed: _('Wed'), thu: _('Thu'), fri: _('Fri'), sat: _('Sat'), sun: _('Sun') };
	let sorted = dayList.slice().sort((a, b) => order.indexOf(a) - order.indexOf(b));
	if (sorted.length === 7) return _('Every day');
	if (sorted.length === 5 && sorted.join(',') === 'mon,tue,wed,thu,fri') return _('Mon-Fri');
	if (sorted.length === 2 && sorted.join(',') === 'sat,sun') return _('Sat-Sun');
	let ranges = [], i = 0;
	while (i < sorted.length) {
		let start = i;
		while (i + 1 < sorted.length && order.indexOf(sorted[i + 1]) === order.indexOf(sorted[i]) + 1) i++;
		if (i - start >= 2) ranges.push(labels[sorted[start]] + '-' + labels[sorted[i]]);
		else for (let j = start; j <= i; j++) ranges.push(labels[sorted[j]]);
		i++;
	}
	return ranges.join(', ');
}

function formatScheduleLines(scheduleStr) {
	if (!scheduleStr) return ['-'];
	return scheduleStr.split('|').map(function(s) {
		let parts = s.trim().split(' ');
		if (parts.length < 2) return s;
		return compactDays(parts[0].split(',')) + ' ' + parts[1];
	});
}

function statusBadge(status, overrideRemaining) {
	let cls, text;
	switch (status) {
		case 'active':    cls = 'pc-badge pc-badge-blocked';  text = '🔒 ' + _('Blocked'); break;
		case 'override':  cls = 'pc-badge pc-badge-override';
			let mins = Math.floor(overrideRemaining / 60);
			text = _('Paused on') + ' (' + mins + 'min)'; break;
		case 'scheduled': cls = 'pc-badge pc-badge-scheduled'; text = _('Scheduled'); break;
		default:          cls = 'pc-badge pc-badge-inactive';  text = _('Inactive');
	}
	return E('span', { 'class': cls }, text);
}

function parseSchedules(scheduleStr) {
	if (!scheduleStr) return [];
	return scheduleStr.split('|').map(function(s) {
		let parts = s.trim().split(' ');
		let days  = parts[0] ? parts[0].split(',') : [];
		let times = parts[1] ? parts[1].split('-') : ['22:00', '07:00'];
		return { days: days, start: times[0], end: times[1] || '07:00' };
	});
}

function renderScheduleBlock(prefix, idx, sched, showRemove) {
	let block  = E('div', { 'class': 'pc-sched-block', 'data-sched-idx': idx });
	let header = E('div', { 'class': 'pc-sched-block-header' });
	header.appendChild(E('span', { 'class': 'pc-sched-block-title' }, _('Schedule') + ' ' + (idx + 1)));
	if (showRemove) {
		header.appendChild(E('button', {
			'class': 'btn cbi-button-remove',
			'click': function() { let c = block.parentNode; block.remove(); renumberBlocks(c, prefix); }
		}, _('Delete')));
	}
	block.appendChild(header);

	let dayRow       = E('div', { 'class': 'pc-day-checks' });
	let hiddenInputs = E('div', { 'style': 'display:none;' });
	DAY_NAMES.forEach(function(d, i) {
		let active = sched.days.indexOf(d) >= 0;
		let hi = E('input', { 'type': 'hidden', 'name': prefix + '_day_' + idx + '_' + d, 'value': active ? '1' : '', 'data-hidden-day': d });
		let btn = E('span', {
			'class': 'pc-day-btn' + (active ? ' active' : ''), 'data-day': d, 'data-prefix': prefix, 'data-idx': idx,
			'click': function() {
				btn.classList.toggle('active');
				hi.value = btn.classList.contains('active') ? '1' : '';
			}
		}, DAY_LABELS[i]);
		dayRow.appendChild(btn);
		hiddenInputs.appendChild(hi);
	});
	block.appendChild(dayRow);
	block.appendChild(hiddenInputs);

	block.appendChild(E('div', { 'class': 'pc-time-row' }, [
		E('span', { 'class': 'pc-time-label' }, _('From hour')),
		E('input', { 'type': 'time', 'name': prefix + '_start_' + idx, 'value': sched.start, 'class': 'cbi-input-text', 'style': 'width:130px;' }),
		E('span', { 'class': 'pc-time-label' }, _('to hour')),
		E('input', { 'type': 'time', 'name': prefix + '_end_' + idx, 'value': sched.end, 'class': 'cbi-input-text', 'style': 'width:130px;' })
	]));
	return block;
}

function renumberBlocks(container, prefix) {
	let blocks = container.querySelectorAll('.pc-sched-block');
	blocks.forEach(function(block, newIdx) {
		block.setAttribute('data-sched-idx', newIdx);
		let title = block.querySelector('.pc-sched-block-title');
		if (title) title.textContent = _('Schedule') + ' ' + (newIdx + 1);
		DAY_NAMES.forEach(function(d) {
			let inp = block.querySelector('[name*="_day_"][name$="_' + d + '"]');
			if (inp) inp.name = prefix + '_day_' + newIdx + '_' + d;
		});
		let s = block.querySelector('[name*="_start_"]');
		if (s) s.name = prefix + '_start_' + newIdx;
		let e = block.querySelector('[name*="_end_"]');
		if (e) e.name = prefix + '_end_' + newIdx;
		let rb = block.querySelector('.pc-sched-block-remove');
		if (rb) rb.style.display = blocks.length <= 1 ? 'none' : '';
	});
}

function renderScheduleEditor(prefix, schedules, onChangeCallback) {
	if (!schedules || schedules.length === 0)
		schedules = [{ days: ['mon', 'tue', 'wed', 'thu', 'fri'], start: '22:00', end: '07:00' }];
	let wrapper = E('div');
	let bd = E('div', { 'class': 'pc-sched-blocks' });
	schedules.forEach(function(sched, idx) {
		bd.appendChild(renderScheduleBlock(prefix, idx, sched, schedules.length > 1));
	});
	wrapper.appendChild(bd);
	wrapper.appendChild(E('button', {
		'class': 'btn cbi-button-action important', 'style': 'margin-top:4px;',
		'click': function(ev) {
			ev.preventDefault();
			let n = bd.querySelectorAll('.pc-sched-block').length;
			bd.appendChild(renderScheduleBlock(prefix, n, { days: ['sat', 'sun'], start: '22:00', end: '08:00' }, true));
			renumberBlocks(bd, prefix);
			if (onChangeCallback) {
				setTimeout(function() {
					let dayBtns = bd.querySelectorAll('.pc-day-btn');
					dayBtns.forEach(function(btn) {
						if (!btn.hasListener) {
							btn.addEventListener('click', onChangeCallback);
							btn.hasListener = true;
						}
					});
				}, 50);
			}
		}
	}, '+ ' + _('Add Schedule')));
	return wrapper;
}

function collectSchedules(container, prefix) {
	let schedules = [], idx = 0;
	while (true) {
		let si = container.querySelector('[name="' + prefix + '_start_' + idx + '"]');
		if (!si) break;
		let ei   = container.querySelector('[name="' + prefix + '_end_' + idx + '"]');
		let days = [];
		DAY_NAMES.forEach(function(d) {
			let inp = container.querySelector('[name="' + prefix + '_day_' + idx + '_' + d + '"]');
			if (inp && inp.value === '1') days.push(d);
		});
		if (days.length > 0 && si.value && ei.value)
			schedules.push(days.join(',') + ' ' + si.value + '-' + ei.value);
		idx++;
	}
	return schedules.length > 0 ? schedules.join('|') : null;
}

function showModal(title, contentFn, footerFn) {
	let body = E('div', { 'class': 'cbi-section', 'style': 'min-width:460px; max-width:580px; box-sizing:border-box;' });
	contentFn(body);

	let closeModal = function() {
		try {
			ui.hideModal();
		} catch(e) {
			console.error('Error closing modal:', e);
		}
	};

	let footer = E('div', { 'style': 'display:flex; gap:8px; justify-content:flex-end; margin-top:16px; padding-top:12px; border-top:1px solid rgba(128,128,128,0.2);' });
	footerFn(footer, body, closeModal);

	ui.showModal(title, [body, footer], 'cbi-modal');
	return { close: closeModal };
}

let _cachedDevices  = [];
let _tableContainer = null;
let _globalContainer = null;

function refreshView() {
	return Promise.all([callGetStatus(), callListDevices()]).then(function(data) {
		let status     = data[0] || {};
		let deviceData = data[1] || {};
		if (_globalContainer) renderGlobal(_globalContainer, status.global_enabled);
		if (_tableContainer)  renderTable(_tableContainer, status.rules || [], status.global_enabled);
		_cachedDevices = (deviceData.devices || []).slice().sort(function(a, b) {
			let an = a.hostname || '', bn = b.hostname || '';
			if (an && !bn) return -1;
			if (!an && bn) return 1;
			return an.localeCompare(bn);
		});
	});
}

function renderGlobal(container, globalEnabled) {
	container.innerHTML = '';
	container.appendChild(E('span', { 'class': 'pc-header-label' }, _('Parental Control Service') + ':'));
	container.appendChild(E('button', {
		'class': globalEnabled ? 'btn cbi-button-remove' : 'btn cbi-button-add',
		'click': function() {
			callToggleGlobal(globalEnabled ? 0 : 1).then(function() {
				popTimeout(null, E('p', {}, globalEnabled ? _('Parental control disabled') : _('Parental control enabled')), 5000, 'info');
				refreshView();
			});
		}
	}, globalEnabled ? _('Disable') : _('Enable')));
	container.appendChild(E('span', {
		'class': 'pc-header-status',
		'style': 'color:' + (globalEnabled ? '#66bb6a' : '#888')
	}, globalEnabled ? _('Active') : _('Disabled')));
}

function openAddModal() {
	let addRuleBtn = null;

	showModal(_('Add New Rule'), function(body) {
		body.appendChild(E('div', { 'class': 'pc-modal-error', 'style': 'display:none;' }));

		body.appendChild(E('div', { 'class': 'cbi-value' }, [
			E('label', { 'class': 'cbi-value-title' }, _('Device Name')),
			E('div', { 'class': 'cbi-value-field' }, [
				E('input', { 'type': 'text', 'name': 'rule_name', 'placeholder': _('e.g. Kids iPad'), 'class': 'cbi-input-text',
					'input': function() {
						let err = body.querySelector('.pc-modal-error');
						if (err) err.style.display = 'none';
						validateAddForm();
					}
				})
			])
		]));
		body.appendChild(E('div', { 'class': 'cbi-value' }, [
			E('label', { 'class': 'cbi-value-title' }, _('Device')),
			E('div', { 'class': 'cbi-value-field' }, [
				(function() {
					let sel = E('select', { 'name': 'rule_mac', 'class': 'cbi-input-select', 'style': 'width:100%;',
						'change': function() {
							let opt       = sel.options[sel.selectedIndex];
							let nameInput = body.querySelector('[name="rule_name"]');
							if (nameInput && !nameInput.value.trim() && opt.dataset.hostname) {
								nameInput.value = opt.dataset.hostname;
							}
							let err = body.querySelector('.pc-modal-error');
							if (err) err.style.display = 'none';
							validateAddForm();
						}
					});
					sel.appendChild(E('option', { 'value': '' }, _('-- Select a device --')));
					_cachedDevices.forEach(function(dev) {
						let lbl      = dev.mac;
						let hostname = '';
						if (dev.hostname && dev.hostname !== 'unknown' && dev.hostname !== '') {
							hostname = dev.hostname;
							lbl = hostname + ' (' + dev.mac + ')';
						}
						if (dev.ip) lbl += ' - ' + dev.ip;
						let opt = E('option', { 'value': dev.mac, 'data-hostname': hostname }, lbl);
						sel.appendChild(opt);
					});
					return sel;
				})()
			])
		]));
		body.appendChild(E('div', { 'class': 'cbi-value' }, [
			E('label', { 'class': 'cbi-value-title' }, _('MAC (manual)')),
			E('div', { 'class': 'cbi-value-field' }, [
				E('input', { 'type': 'text', 'name': 'rule_mac_manual', 'placeholder': 'AA:BB:CC:DD:EE:FF', 'class': 'cbi-input-text' })
			])
		]));
		body.appendChild(E('div', { 'class': 'cbi-value' }, [
			E('label', { 'class': 'cbi-value-title' }, _('Block Schedule')),
			E('div', { 'class': 'cbi-value-field' }, [
				renderScheduleEditor('add', null, function() {
					setTimeout(function() { validateAddForm(); }, 50);
				})
			])
		]));

		setTimeout(function() {
			let dayBtns = body.querySelectorAll('.pc-day-btn');
			dayBtns.forEach(function(btn) {
				if (!btn.hasListener) {
					btn.addEventListener('click', function() {
						setTimeout(function() { validateAddForm(); }, 50);
					});
					btn.hasListener = true;
				}
			});
		}, 100);

		function validateAddForm() {
			try {
				let mac    = body.querySelector('[name="rule_mac"]').value;
				let mm     = body.querySelector('[name="rule_mac_manual"]').value.trim();
				if (mm) mac = mm;
				let scheds    = collectSchedules(body, 'add');
				let canEnable = (mac && scheds);
				if (addRuleBtn) {
					addRuleBtn.disabled           = !canEnable;
					addRuleBtn.style.opacity      = canEnable ? '1' : '0.4';
					addRuleBtn.style.pointerEvents = canEnable ? 'auto' : 'none';
				}
			} catch(e) {
				console.error('Validation error:', e);
			}
		}

		setTimeout(validateAddForm, 50);

	}, function(footer, body, closeModal) {
		function hideDayChecks() {
			body.querySelectorAll('.pc-day-checks').forEach(function(el) { el.style.display = 'none'; });
		}
		footer.appendChild(E('button', { 'class': 'btn', 'click': function() { hideDayChecks(); closeModal(); } }, _('Cancel')));
		addRuleBtn = E('button', {
			'class': 'btn cbi-button-save',
			'disabled': '',
			'style': 'opacity:0.4; pointer-events:none;',
			'click': function() {
				let name = body.querySelector('[name="rule_name"]').value.trim();
				let mac  = body.querySelector('[name="rule_mac"]').value;
				let mm   = body.querySelector('[name="rule_mac_manual"]').value.trim();
				if (mm) mac = mm;
				if (!name) {
					let err = body.querySelector('.pc-modal-error');
					err.textContent = _('Please enter a device name.');
					err.style.display = 'block';
					return;
				}
				if (!mac) {
					let err = body.querySelector('.pc-modal-error');
					err.textContent = _('Please select or enter a MAC address.');
					err.style.display = 'block';
					return;
				}
				let scheds = collectSchedules(body, 'add');
				if (!scheds) {
					let err = body.querySelector('.pc-modal-error');
					err.textContent = _('Please configure at least one schedule.');
					err.style.display = 'block';
					return;
				}
				hideDayChecks();
				callAddRule(name, mac, scheds, 1).then(function() {
					closeModal();
					popTimeout(null, E('p', {}, '"' + name + '" ' + _('added')), 5000, 'info');
					refreshView();
				});
			}
		}, _('Add Rule'));
		footer.appendChild(addRuleBtn);
	});
}

function openEditModal(rule) {
	showModal(_('Edit Rule') + ' - ' + (rule.name || rule.mac), function(body) {
		body.appendChild(E('div', { 'class': 'pc-modal-error', 'style': 'display:none;' }));

		body.appendChild(E('div', { 'class': 'cbi-value' }, [
			E('label', { 'class': 'cbi-value-title' }, _('Device Name')),
			E('div', { 'class': 'cbi-value-field' }, [
				E('input', { 'type': 'text', 'name': 'edit_name', 'value': rule.name || '', 'class': 'cbi-input-text',
					'input': function() { let err = body.querySelector('.pc-modal-error'); if (err) err.style.display = 'none'; }
				})
			])
		]));
		body.appendChild(E('div', { 'class': 'cbi-value' }, [
			E('label', { 'class': 'cbi-value-title' }, _('MAC Address')),
			E('div', { 'class': 'cbi-value-field' }, [
				E('input', { 'type': 'text', 'value': rule.mac || '', 'class': 'cbi-input-text', 'disabled': '', 'style': 'opacity:0.5;' })
			])
		]));
		body.appendChild(E('div', { 'class': 'cbi-value' }, [
			E('label', { 'class': 'cbi-value-title' }, _('Block Schedule')),
			E('div', { 'class': 'cbi-value-field' }, [
				renderScheduleEditor('edit', parseSchedules(rule.schedules), null)
			])
		]));
	}, function(footer, body, closeModal) {
		function hideDayChecks() {
			body.querySelectorAll('.pc-day-checks').forEach(function(el) { el.style.display = 'none'; });
		}
		footer.appendChild(E('button', { 'class': 'btn', 'click': function() { hideDayChecks(); closeModal(); } }, _('Cancel')));
		footer.appendChild(E('button', {
			'class': 'btn cbi-button-save',
			'click': function() {
				let name = body.querySelector('[name="edit_name"]').value.trim();
				if (!name) {
					let err = body.querySelector('.pc-modal-error');
					err.textContent = _('Please enter a device name.');
					err.style.display = 'block';
					return;
				}
				let scheds = collectSchedules(body, 'edit');
				if (!scheds) {
					let err = body.querySelector('.pc-modal-error');
					err.textContent = _('Please configure at least one schedule.');
					err.style.display = 'block';
					return;
				}
				hideDayChecks();
				callUpdateRule(rule.section, name, scheds, rule.enabled ? 1 : 0).then(function() {
					closeModal();
					popTimeout(null, E('p', {}, '"' + name + '" ' + _('updated')), 5000, 'info');
					refreshView();
				});
			}
		}, _('Save Changes')));
	});
}

function renderTable(container, rules, globalEnabled) {
	container.innerHTML = '';

	if (rules.length === 0) {
		container.appendChild(E('p', { 'style': 'opacity:0.5;padding:8px 0;' }, _('No parental control rules configured.')));
		return;
	}

	let table = E('div', { 'class': 'table cbi-section-table pc-table' });
	table.appendChild(E('div', { 'class': 'tr table-titles' }, [
		E('div', { 'class': 'th', 'style': 'width:30px;' }, ''),
		E('div', { 'class': 'th' }, _('Device')),
		E('div', { 'class': 'th', 'style': 'text-align:center;width:60px;' }, _('Enabled')),
		E('div', { 'class': 'th' }, _('Schedule')),
		E('div', { 'class': 'th', 'style': 'width:120px;' }, _('Status')),
		E('div', { 'class': 'th', 'style': 'width:100px;' }, _('Blocked')),
		E('div', { 'class': 'th', 'style': 'width:200px;' }, _('Bonus Time')),
		E('div', { 'class': 'th cbi-section-actions' }, '')
	]));

	let dragState = { dragIdx: -1 };

	rules.forEach(function(rule, ruleIdx) {
		let row = E('div', { 'class': 'tr', 'draggable': 'true', 'data-rule-idx': ruleIdx, 'data-rule-section': rule.section });

		row.addEventListener('dragstart', function(ev) {
			dragState.dragIdx = ruleIdx;
			row.classList.add('pc-dragging');
			ev.dataTransfer.effectAllowed = 'move';
			ev.dataTransfer.setData('text/plain', ruleIdx.toString());
		});
		row.addEventListener('dragend', function() {
			row.classList.remove('pc-dragging');
			table.querySelectorAll('.pc-drag-over, .pc-drag-over-below').forEach(function(el) {
				el.classList.remove('pc-drag-over', 'pc-drag-over-below');
			});
			dragState.dragIdx = -1;
		});
		row.addEventListener('dragover', function(ev) {
			ev.preventDefault();
			ev.dataTransfer.dropEffect = 'move';
			if (dragState.dragIdx === ruleIdx) return;
			table.querySelectorAll('.pc-drag-over, .pc-drag-over-below').forEach(function(el) {
				el.classList.remove('pc-drag-over', 'pc-drag-over-below');
			});
			if (dragState.dragIdx < ruleIdx) {
				row.classList.add('pc-drag-over-below');
			} else {
				row.classList.add('pc-drag-over');
			}
		});
		row.addEventListener('dragleave', function() {
			row.classList.remove('pc-drag-over', 'pc-drag-over-below');
		});
		row.addEventListener('drop', function(ev) {
			ev.preventDefault();
			row.classList.remove('pc-drag-over', 'pc-drag-over-below');
			let fromIdx  = dragState.dragIdx;
			let toIdx    = ruleIdx;
			if (fromIdx === toIdx || fromIdx < 0) return;
			let fromRule = rules[fromIdx];
			callReorderRule(fromRule.section, toIdx).then(function() {
				popTimeout(null, E('p', {}, _('Moved') + ' "' + fromRule.name + '"'), 5000, 'info');
				refreshView();
			});
		});

		// Reorder cell
		let reorderCell = E('div', { 'class': 'td pc-reorder-td', 'style': 'padding:4px;flex:0 0 30px;' });
		let cellContent = E('div', { 'class': 'pc-reorder-cell' });
		cellContent.appendChild(E('button', {
			'class': 'pc-btn-arrow', 'title': _('Move up'),
			'disabled': ruleIdx === 0 ? '' : null,
			'click': function() {
				callMoveRule(rule.section, 'up').then(function() {
					popTimeout(null, E('p', {}, _('Moved') + ' "' + rule.name + '" ' + _('up')), 5000, 'info');
					refreshView();
				});
			}
		}, '▲'));
		let dragHandle = E('span', { 'class': 'pc-drag-handle', 'title': _('Drag to reorder') }, '⠿');

		(function(handle, srcIdx, srcRule) {
			let touchTarget = null;

			handle.addEventListener('touchstart', function(ev) {
				ev.preventDefault();
				dragState.dragIdx = srcIdx;
				row.classList.add('pc-dragging');
			}, { passive: false });

			handle.addEventListener('touchmove', function(ev) {
				ev.preventDefault();
				let touch = ev.touches[0];
				let el    = document.elementFromPoint(touch.clientX, touch.clientY);
				if (!el) return;

				let targetRow = el.closest('.tr[data-rule-idx]');
				table.querySelectorAll('.pc-drag-over, .pc-drag-over-below').forEach(function(r) {
					r.classList.remove('pc-drag-over', 'pc-drag-over-below');
				});

				if (targetRow && targetRow !== row) {
					let targetIdx = parseInt(targetRow.getAttribute('data-rule-idx'));
					touchTarget = targetIdx;
					if (srcIdx < targetIdx) {
						targetRow.classList.add('pc-drag-over-below');
					} else {
						targetRow.classList.add('pc-drag-over');
					}
				} else {
					touchTarget = null;
				}
			}, { passive: false });

			handle.addEventListener('touchend', function() {
				row.classList.remove('pc-dragging');
				table.querySelectorAll('.pc-drag-over, .pc-drag-over-below').forEach(function(r) {
					r.classList.remove('pc-drag-over', 'pc-drag-over-below');
				});
				dragState.dragIdx = -1;

				if (touchTarget !== null && touchTarget !== srcIdx) {
					callReorderRule(srcRule.section, touchTarget).then(function() {
						popTimeout(null, E('p', {}, _('Moved') + ' "' + srcRule.name + '"'), 5000, 'info');
						refreshView();
					});
				}
				touchTarget = null;
			});
		})(dragHandle, ruleIdx, rule);

		cellContent.appendChild(dragHandle);
		cellContent.appendChild(E('button', {
			'class': 'pc-btn-arrow', 'title': _('Move down'),
			'disabled': ruleIdx === rules.length - 1 ? '' : null,
			'click': function() {
				callMoveRule(rule.section, 'down').then(function() {
					popTimeout(null, E('p', {}, _('Moved') + ' "' + rule.name + '" ' + _('down')), 5000, 'info');
					refreshView();
				});
			}
		}, '▼'));
		reorderCell.appendChild(cellContent);
		row.appendChild(reorderCell);

		// Device
		row.appendChild(E('div', { 'class': 'td', 'data-title': _('Device') }, [
			E('div', { 'style': 'font-weight:600;' }, rule.name || '-'),
			E('div', { 'class': 'pc-mac' }, rule.mac || '')
		]));

		// Enabled (before Schedule)
		let enableCell = E('div', { 'class': 'td', 'data-title': _('Enabled'), 'style': 'text-align:center;' });
		enableCell.appendChild(E('input', {
			'type': 'checkbox', 'class': 'cbi-input-checkbox',
			'checked': rule.enabled ? '' : null,
			'change': (function(r) {
				return function(ev) {
					let enabling = ev.target.checked;
					callToggleRule(r.section, enabling ? 1 : 0).then(function() {
						popTimeout(null, E('p', {}, '"' + r.name + '" ' + (enabling ? _('enabled') : _('disabled'))), 5000, 'info');
						refreshView();
					});
				};
			})(rule)
		}));
		row.appendChild(enableCell);

		// Schedule
		let schedCell = E('div', { 'class': 'td', 'data-title': _('Schedule') });
		formatScheduleLines(rule.schedules).forEach(function(line) {
			schedCell.appendChild(E('span', { 'class': 'pc-sched-line' }, line));
		});
		row.appendChild(schedCell);

		// Status
		row.appendChild(E('div', { 'class': 'td', 'data-title': _('Status') }, [statusBadge(rule.status, rule.override_remaining)]));

		// Blocked stats
		let packets   = rule.blocked_packets || 0;
		let bytes     = rule.blocked_bytes || 0;
		let statsCell = E('div', { 'class': 'td' + (packets === 0 && bytes === 0 ? ' pc-stats-empty' : ''), 'data-title': _('Blocked') });
		if (packets > 0 || bytes > 0) {
			statsCell.appendChild(E('div', { 'class': 'pc-stats' }, [
				E('span', { 'class': 'pc-stats-packets' }, formatPackets(packets) + ' ' + _('pkts')),
				E('br'),
				E('span', { 'class': 'pc-stats-bytes' }, formatBytes(bytes))
			]));
		} else {
			statsCell.appendChild(E('span', { 'style': 'opacity:0.3;font-size:12px;' }, '—'));
		}
		row.appendChild(statsCell);

		// Bonus Time
		let overrideCell = E('div', { 'class': 'td', 'data-title': _('Bonus Time') });
		let oc = E('div', { 'class': 'pc-override-cell' });
		if (rule.enabled && rule.status === 'active') {
			oc.appendChild(E('select', {
				'class': 'cbi-input-select',
				'change': (function(r) {
					return function(ev) {
						let m = parseInt(ev.target.value);
						if (m > 0) {
							callSetOverride(r.section, m).then(function() {
								popTimeout(null, E('p', {}, '"' + r.name + '" ' + _('blocking has been paused on') + ' ' + (m >= 60 ? (m/60) + _('h') : m + _('m'))), 5000, 'info');
								refreshView();
							});
						}
					};
				})(rule)
			}, [
				E('option', { 'value': '0' }, _('Add time') + '...'),
				E('option', { 'value': '30' }, '30 ' + _('min')),
				E('option', { 'value': '60' }, '1 ' + _('hour')),
				E('option', { 'value': '120' }, '2 ' + _('hours'))
			]));
		} else if (rule.status === 'override') {
			let remaining = rule.override_remaining || 0;
			let mins      = Math.floor(remaining / 60);
			oc.appendChild(E('span', { 'class': 'pc-override-info' }, '⏳ (' + mins + 'min)'));
			oc.appendChild(E('button', {
				'class': 'btn cbi-button-action',
				'click': (function(r) {
					return function() {
						callCancelOverride(r.section).then(function() {
							popTimeout(null, E('p', {}, '"' + r.name + '" ' + _('blocking resumed')), 5000, 'info');
							refreshView();
						});
					};
				})(rule)
			}, _('Resume') + ' 🔒'));
		} else {
			oc.appendChild(E('span', { 'style': 'opacity:0.3;font-size:12px;' }, '—'));
		}
		overrideCell.appendChild(oc);
		row.appendChild(overrideCell);

		// Actions
		let actions = E('div', { 'class': 'td cbi-section-actions' });
		let ar      = E('div', { 'class': 'pc-actions' });
		ar.appendChild(E('button', {
			'class': 'btn cbi-button-action important',
			'click': (function(r) { return function() { openEditModal(r); }; })(rule)
		}, _('Edit')));
		ar.appendChild(E('button', {
			'class': 'btn cbi-button-remove',
			'click': (function(r) {
				return function() {
					if (confirm(_('Delete rule') + ' "' + (r.name || r.mac) + '"?')) {
						callDeleteRule(r.section).then(function() {
							popTimeout(null, E('p', {}, '"' + r.name + '" ' + _('deleted')), 5000, 'info');
							refreshView();
						});
					}
				};
			})(rule)
		}, _('Delete')));
		actions.appendChild(ar);
		row.appendChild(actions);
		table.appendChild(row);
	});

	container.appendChild(table);
}

return view.extend({
	load: function() {
		return Promise.all([callGetStatus(), callListDevices()]);
	},

	render: function(data) {
		addPcDarkModeStyles();
		let status        = data[0] || {};
		let deviceData    = data[1] || {};
		let rules         = status.rules || [];
		let globalEnabled = status.global_enabled;

		_cachedDevices = (deviceData.devices || []).slice().sort(function(a, b) {
			let an = a.hostname || '', bn = b.hostname || '';
			if (an && !bn) return -1;
			if (!an && bn) return 1;
			return an.localeCompare(bn);
		});

		let viewEl = E('div', { 'class': 'cbi-map' });
		viewEl.appendChild(E('style', {}, CSS));
		viewEl.appendChild(E('h2', { 'class': 'fade-in' }, _('Parental Control')));
		viewEl.appendChild(E('div', { 'class': 'cbi-section-descr fade-in' },
			_('Package allows the user to manage parental control rules - block internet access for selected devices on a schedule and grant temporary bonus time.')));

		_globalContainer = E('div', { 'class': 'pc-header' });
		renderGlobal(_globalContainer, globalEnabled);
		viewEl.appendChild(_globalContainer);

		let titleRow = E('div', { 'style': 'display:flex; align-items:center; justify-content:space-between; margin:20px 0 10px;' });
		titleRow.appendChild(E('div', { 'class': 'pc-section-title', 'style': 'margin:0;' }, _('Controlled Devices')));
		titleRow.appendChild(E('button', {
			'class': 'btn cbi-button-add',
			'click': function() { openAddModal(); }
		}, '＋ ' + _('Add Rule')));
		viewEl.appendChild(titleRow);

		_tableContainer = E('div');
		renderTable(_tableContainer, rules, globalEnabled);
		viewEl.appendChild(_tableContainer);

		poll.add(function() { refreshView(); });

		return viewEl;
	},

	handleSaveApply: null,
	handleSave: null,
	handleReset: null
});
