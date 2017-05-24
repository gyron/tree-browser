interface NodeConfigCheckbox {
	enabled: boolean, // if false, everything else is ignored.
	name?: string,
	value?: string,
	// todo: radio: boolean // allows setting radio so that any other sibling that is radio also is toggled.
	pseudo?: boolean, // means don't send to backend
	// todo: triState: boolean, // if true it uses a box to represent selected + some children
	state?: number, //-1, 0, 1 //(-1=semi) or maybe an enum?
	// todo: clickable: boolean, // could make it look faint if false, i.e. is passive
	togglesChildren?: boolean,
	// todo: togglesParent: boolean,
}

interface NodeConfigIcon {
	enabled: boolean
}

interface NodeConfigExpand {
	enabled: boolean,
	expanded?: boolean
}

interface NodeConfig {
	text: string,
	checkbox: NodeConfigCheckbox,
	//icon: NodeConfigIcon,
	expand: NodeConfigExpand
	children: NodeConfig[]
}

interface TreeBrowserConfig {
	nodes: NodeConfig[],
	displayRoots?: boolean,
	jquery: string, // some people don't allow the global "$", so needs to be configurable
	renderTo: JQuery,
	renderDelegates?: any // todo: interface with supported delegates
}

interface Window { [key: string]: any }

export default class TreeBrowser {

	constructor( private config: TreeBrowserConfig ) {
		this.applyConfigDefaults();

		// todo: handle postponed init in config
		this.init();
	}

	private init() {
		const rootNodes = this.config.nodes.map( _ => this.generateNodeHtml(_) );

		this.config.renderTo
			.append( this.query( '<ul>' ).append( rootNodes ) )
			.addClass( 'tree-browser' );

		this.query( 'a.toggle', this.config.renderTo )
			.on( 'click.tree-browser', ( e: any ) => this.onClickExpandToggle( e ) );

		this.query( 'input[type="checkbox"]', this.config.renderTo )
			.on( 'change.tree-browser', ( e: any ) => this.onChangeCheckbox( e ) );

		this.query( '.treenode-content > a:last-child', this.config.renderTo )
			.on( 'click.tree-browser', ( e: any ) => this.onClickRow( e ) );
	}

	private applyConfigDefaults() {
		this.config.jquery = this.config.jquery || '$';
	}

	private applyNodeDefaults( nodeConfig: any ) {
		const defaultConfig = {
			text: '',
			checkbox: { enabled: false },
			expand: { enabled: false },
			children: []
		};
		return $.extend( {}, defaultConfig, nodeConfig );
	}

	private query( anything: any, parentEl: JQuery = null ): JQuery {
		return window[this.config.jquery]( anything, parentEl );
	}

	private onChangeCheckbox( event: any ) {
		const checkbox = this.query( event.currentTarget );
		const isChecked = checkbox.prop( 'checked' );
		const isHandlerOnly = event.handlerOnly || false;

		const treeNodeLi = checkbox.closest( 'li' );
		const node = treeNodeLi.data( 'treenode' );

		if ( node.checkbox.togglesParent ) {
			const parentUl = treeNodeLi.closest( 'ul' );
			const siblingCheckboxes = parentUl.find( '> li > .treenode-content input[type="checkbox"]' );
			const checkedSiblings = siblingCheckboxes.filter( ( i:number, el: HTMLElement ) => this.query( el ).is( ':checked' ) );
			const indeterminateSiblings = siblingCheckboxes.filter( ( i:number, el: HTMLElement ) => this.query( el ).is( ':indeterminate' ) );

			const isSomeChecked = ( checkedSiblings.length > 0 && checkedSiblings.length != siblingCheckboxes.length );
			const isNoneChecked = ( checkedSiblings.length == 0 );
			const isAllChecked = !isNoneChecked && !isSomeChecked;
			const isSomeIndeterminate = ( indeterminateSiblings.length > 0 );

			const parentCheckbox = parentUl.siblings( '.treenode-content' ).find( 'input[type="checkbox"]' );

			parentCheckbox.prop( 'indeterminate', isSomeChecked || isSomeIndeterminate );
			parentCheckbox.prop( 'checked', isAllChecked );

			parentCheckbox.triggerHandler( { type: "change", handlerOnly: true } );
		}

		if ( !isHandlerOnly && node.checkbox.togglesChildren ) {
			treeNodeLi.find( 'ul input[type=checkbox]' ).prop( 'checked', checkbox.prop( 'checked' ) );
		}
	}

	private onClickExpandToggle( event: any ) {
		const expandLink = this.query( event.currentTarget );
		const treeNodeLi = expandLink.closest( 'li' );

		expandLink.toggleClass( 'expanded' );
		expandLink.html( this.config.renderDelegates.expand( treeNodeLi.data( 'treenode' ), expandLink.hasClass( 'expanded' ) ) );
		expandLink.parent().siblings( 'ul' ).toggleClass( 'hidden' );
	}

	private onClickRow( event: any ) {
		event.preventDefault();
		event.stopPropagation();

		this.query( 'input[type="checkbox"]', this.query( event.currentTarget ).parent() ).click();
	}

	private generateNodeHtml( node: NodeConfig ): JQuery {
		node = this.applyNodeDefaults( node );

		let nodeHtml: JQuery = this.query( `
			<li class="treenode">
				<div class="treenode-content">
					<a unselectable="on" class="node-title">${node.text}</a>
				</div>
				<div class="treenode-underlay"></div>
				<ul class="hidden"></ul>
			</li>`
		);

		const nodeContent = nodeHtml.find( '> .treenode-content' );

		if ( node.checkbox.enabled ) {
			let checkboxContainer: JQuery;

			if ( this.config.renderDelegates.checkbox ) {
				checkboxContainer = this.query( this.config.renderDelegates.checkbox( node ) );
			}
			else {
				// todo: move this to some kind of template?
				checkboxContainer = this.query( `<span class="treenode-checkbox"><input name="${node.checkbox.name}" value="${node.checkbox.value}" type="checkbox" /></span>` );
			}

			const checkbox = checkboxContainer.find( 'input[type="checkbox"]' );
			if ( node.checkbox.pseudo ) {
				checkbox
					.addClass( 'pseudo' )
					.prop( 'pseudo', true )
					.removeAttr( 'name' )
					.removeAttr( 'value' );
			}

			if ( node.checkbox.state == 1 ) {
				checkbox.attr( 'checked', 'checked' );
				checkbox.prop( 'checked', true );
			}
			nodeContent.prepend( checkboxContainer );
		}
		else if ( this.config.renderDelegates.checkboxSpacer ) {
			// todo: checkboxSpacer
		}

		if ( node.expand.enabled && node.children.length > 0 ) {
			const childNodes = node.children.map( _ => this.generateNodeHtml( _ ) );
			const childNodeContainer = nodeHtml.find( '> ul' );
			const expandLink = this.query( '<a class="toggle"></a>' );

			childNodeContainer.append( childNodes );
			childNodeContainer.toggleClass( 'hidden', !node.expand.expanded );

			expandLink.toggleClass( 'expanded', node.expand.expanded );
			expandLink.html( this.config.renderDelegates.expand( node, node.expand.expanded ) );
			nodeContent.prepend( expandLink );
		}
		else if ( this.config.renderDelegates.expandSpacer ) {
			const expandSpacer = this.query( this.config.renderDelegates.expandSpacer( node ) );
			nodeContent.prepend( expandSpacer );
		}

		return nodeHtml.data( 'treenode', node );
	}
}