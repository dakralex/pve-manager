Ext.define('PVE.lxc.Config', {
    extend: 'PVE.panel.Config',
    alias: 'widget.PVE.lxc.Config',

    initComponent: function() {
        var me = this;

	var nodename = me.pveSelNode.data.node;
	if (!nodename) {
	    throw "no node name specified";
	}

	var vmid = me.pveSelNode.data.vmid;
	if (!vmid) {
	    throw "no VM ID specified";
	}

	var template = me.pveSelNode.data.template;

	var caps = Ext.state.Manager.get('GuiCap');

	var base_url = '/nodes/' + nodename + '/lxc/' + vmid;

	me.statusStore = Ext.create('PVE.data.ObjectStore', {
	    url: '/api2/json' + base_url + '/status/current',
	    interval: 1000
	});

	var vm_command = function(cmd, params) {
	    PVE.Utils.API2Request({
		params: params,
		url: base_url + "/status/" + cmd,
		waitMsgTarget: me,
		method: 'POST',
		failure: function(response, opts) {
		    Ext.Msg.alert('Error', response.htmlStatus);
		}
	    });
	};

	var startBtn = Ext.create('Ext.Button', {
	    text: gettext('Start'),
	    disabled: !caps.vms['VM.PowerMgmt'],
	    handler: function() {
		vm_command('start');
	    },
	    iconCls: 'fa fa-play'
	});

	var umountBtn = Ext.create('Ext.Button', {
	    text: gettext('Unmount'),
	    disabled: true,
	    hidden: true,
	    handler: function() {
		vm_command('umount');
	    }
	});

	var stopBtn = Ext.create('Ext.menu.Item',{
	    text: gettext('Stop'),
	    disabled: !caps.vms['VM.PowerMgmt'],
	    confirmMsg: PVE.Utils.format_task_description('vzstop', vmid),
	    dangerous: true,
	    handler: function() {
		vm_command("stop");
	    },
	    iconCls: 'fa fa-stop'
	});

	var shutdownBtn = Ext.create('PVE.button.Split', {
	    text: gettext('Shutdown'),
	    disabled: !caps.vms['VM.PowerMgmt'],
	    confirmMsg: PVE.Utils.format_task_description('vzshutdown', vmid),
	    handler: function() {
		vm_command('shutdown');
	    },
	    menu: {
		items:[stopBtn]
	    },
	    iconCls: 'fa fa-power-off'
	});

	var migrateBtn = Ext.create('Ext.Button', {
	    text: gettext('Migrate'),
	    disabled: !caps.vms['VM.Migrate'],
	    handler: function() {
		var win = Ext.create('PVE.window.Migrate', {
		    vmtype: 'lxc',
		    nodename: nodename,
		    vmid: vmid
		});
		win.show();
	    },
	    iconCls: 'fa fa-send-o'
	});

	var removeBtn = Ext.create('PVE.button.Button', {
	    text: gettext('Remove'),
	    disabled: !caps.vms['VM.Allocate'],
	    handler: function() {
		Ext.create('PVE.window.SafeDestroy', {
		    url: base_url,
		    item: { type: 'CT', id: vmid }
		}).show();
	    },
	    iconCls: 'fa fa-trash-o'
	});

	var vmname = me.pveSelNode.data.name;

	var consoleBtn = Ext.create('PVE.button.ConsoleButton', {
	    disabled: !caps.vms['VM.Console'],
	    consoleType: 'lxc',
	    consoleName: vmname,
	    nodename: nodename,
	    vmid: vmid,
	    iconCls: 'fa fa-terminal'
	});

	var descr = vmid + " (" + (vmname ? "'" + vmname + "' " : "'CT " + vmid + "'") + ")";

	Ext.apply(me, {
	    title: Ext.String.format(gettext("Container {0} on node {1}"), descr, "'" + nodename + "'"),
	    hstateid: 'lxctab',
	    tbar: [ startBtn, shutdownBtn, umountBtn, removeBtn,
		    migrateBtn, consoleBtn ],
	    defaults: { statusStore: me.statusStore },
	    items: [
		{
		    title: gettext('Summary'),
		    xtype: 'pveLxcSummary',
		    itemId: 'summary'
		},
		{
		    title: gettext('Resources'),
		    itemId: 'resources',
		    layout: 'fit',
		    plugins: {
			ptype: 'lazyitems',
			items: [{
			    xtype: 'pveLxcRessourceView',
			    pveSelNode: me.pveSelNode
			}]
		    }
		},
		{
		    title: gettext('Network'),
		    itemId: 'network',
		    xtype: 'pveLxcNetworkView'
		},
		{
		    title: gettext('DNS'),
		    itemId: 'dns',
		    xtype: 'pveLxcDNS'
		},
		{
		    title: gettext('Options'),
		    itemId: 'options',
		    xtype: 'pveLxcOptions'
		},
		{
		    title: gettext('Task History'),
		    itemId: 'tasks',
		    xtype: 'pveNodeTasks',
		    vmidFilter: vmid
		}
	    ]
	});

	if (caps.vms['VM.Backup']) {
	    me.items.push({
		title: gettext('Backup'),
		xtype: 'pveBackupView',
		itemId: 'backup'
	    });
	}

	if (caps.vms['VM.Console']) {
	    me.items.push({
		title: gettext('Console'),
		itemId: 'console',
		xtype: 'pveNoVncConsole',
		vmid: vmid,
		consoleType: 'lxc',
		nodename: nodename
	    });
	}

	if (caps.vms['VM.Snapshot']) {
	    me.items.push({
		title: gettext('Snapshots'),
		xtype: 'pveLxcSnapshotTree',
		itemId: 'snapshot'
	    });
	}

	if (caps.vms['VM.Console']) {
	    me.items.push(
		{
		    xtype: 'pveFirewallPanel',
		    title: gettext('Firewall'),
		    base_url: base_url + '/firewall',
		    fwtype: 'vm',
		    phstateid: me.hstateid,
		    itemId: 'firewall'
		}
	    );
	}

	if (caps.vms['Permissions.Modify']) {
	    me.items.push({
		xtype: 'pveACLView',
		title: gettext('Permissions'),
		itemId: 'permissions',
		path: '/vms/' + vmid
	    });
	}

	me.callParent();

	me.mon(me.statusStore, 'load', function(s, records, success) {
	    var status;
	    if (!success) {
		me.workspace.checkVmMigration(me.pveSelNode);
		status = 'unknown';
	    } else {
		var rec = s.data.get('status');
		status = rec ? rec.data.value : 'unknown';
		rec = s.data.get('template');
		template = rec.data.value || false;
	    }
	    startBtn.setDisabled(!caps.vms['VM.PowerMgmt'] || status === 'running' || template);
	    shutdownBtn.setDisabled(!caps.vms['VM.PowerMgmt'] || status !== 'running');
	    stopBtn.setDisabled(!caps.vms['VM.PowerMgmt'] || status === 'stopped');
	    removeBtn.setDisabled(!caps.vms['VM.Allocate'] || status !== 'stopped');
	    consoleBtn.setDisabled(template);

	    if (status === 'mounted') {
		umountBtn.setDisabled(false);
		umountBtn.setVisible(true);
		stopBtn.setDisabled(true);
	    } else {
		umountBtn.setDisabled(true);
		umountBtn.setVisible(false);
		stopBtn.setDisabled(false);
	    }
	});

	me.on('afterrender', function() {
	    me.statusStore.startUpdate();
	});

	me.on('destroy', function() {
	    me.statusStore.stopUpdate();
	});
    }
});
