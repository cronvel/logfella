(function(f){if(typeof exports==="object"&&typeof module!=="undefined"){module.exports=f()}else if(typeof define==="function"&&define.amd){define([],f)}else{var g;if(typeof window!=="undefined"){g=window}else if(typeof global!=="undefined"){g=global}else if(typeof self!=="undefined"){g=self}else{g=this}g.Logfella = f()}})(function(){var define,module,exports;return (function(){function r(e,n,t){function o(i,f){if(!n[i]){if(!e[i]){var c="function"==typeof require&&require;if(!f&&c)return c(i,!0);if(u)return u(i,!0);var a=new Error("Cannot find module '"+i+"'");throw a.code="MODULE_NOT_FOUND",a}var p=n[i]={exports:{}};e[i][0].call(p.exports,function(r){var n=e[i][1][r];return o(n||r)},p,p.exports,r,e,n,t)}return n[i].exports}for(var u="function"==typeof require&&require,i=0;i<t.length;i++)o(t[i]);return o}return r})()({1:[function(require,module,exports){
/*
	Logfella

	Copyright (c) 2015 - 2019 Cédric Ronvel

	The MIT License (MIT)

	Permission is hereby granted, free of charge, to any person obtaining a copy
	of this software and associated documentation files (the "Software"), to deal
	in the Software without restriction, including without limitation the rights
	to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
	copies of the Software, and to permit persons to whom the Software is
	furnished to do so, subject to the following conditions:

	The above copyright notice and this permission notice shall be included in all
	copies or substantial portions of the Software.

	THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
	IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
	FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
	AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
	LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
	OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
	SOFTWARE.
*/

"use strict" ;



const CommonTransport = require( 'logfella-common-transport' ) ;
const Promise = require( 'seventh' ) ;



function BrowserConsoleTransport( logger , config ) {
	CommonTransport.call( this , logger , config ) ;

	this.color = false ;
	this.indent = config.indent === undefined ? true : !! config.indent ;
	this.includeIdMeta = !! config.includeIdMeta ;
	this.includeCommonMeta = config.includeCommonMeta === undefined ? true : !! config.includeCommonMeta ;
	this.includeUserMeta = config.includeUserMeta === undefined ? true : !! config.includeUserMeta ;
}

module.exports = BrowserConsoleTransport ;

BrowserConsoleTransport.prototype = Object.create( CommonTransport.prototype ) ;
BrowserConsoleTransport.prototype.constructor = BrowserConsoleTransport ;



BrowserConsoleTransport.prototype.transport = function( data , cache ) {
	console.log( this.messageFormatter( data , cache ) + '\n' ) ;
	return Promise.resolved ;
} ;


},{"logfella-common-transport":6,"seventh":14}],2:[function(require,module,exports){
(function (process){
/*
	Logfella

	Copyright (c) 2015 - 2019 Cédric Ronvel

	The MIT License (MIT)

	Permission is hereby granted, free of charge, to any person obtaining a copy
	of this software and associated documentation files (the "Software"), to deal
	in the Software without restriction, including without limitation the rights
	to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
	copies of the Software, and to permit persons to whom the Software is
	furnished to do so, subject to the following conditions:

	The above copyright notice and this permission notice shall be included in all
	copies or substantial portions of the Software.

	THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
	IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
	FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
	AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
	LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
	OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
	SOFTWARE.
*/

"use strict" ;



const Promise = require( 'seventh' ) ;
const string = require( 'string-kit' ) ;
const treeOps = require( 'kung-fig-tree-ops' ) ;
const CommonTransport = require( 'logfella-common-transport' ) ;

var path , os ;
var browserPageTime ;

if ( process.browser ) {
	browserPageTime = Date.now() ;

	if ( process.uptime !== 'function' ) {
		process.uptime = () => Date.now() - browserPageTime ;
	}
}
else {
	path = require( 'path' ) ;
	os = require( 'os' ) ;
}



function Logfella( config ) {
	this.root = this ;
	this.perDomain = null ;
	this.logTransports = [] ;
	this.monTransports = [] ;
	this.app = null ;
	this.pid = null ;
	this.hostname = null ;
	this.minLevel = 3 ;
	this.maxLevel = 7 ;
	this.defaultDomain = 'no-domain' ;
	this.domain = null ;
	this.overrideConsole = false ;
	this.levelArray = defaultLevelArray ;
	this.levelHash = defaultLevelHash ;
	this.mon = { warnings: 0 , errors: 0 } ;
	this.monPeriod = null ;
	this.monStatus = 'stopped' ;

	// Hooks
	this.hook = null ;
	this.monHook = null ;

	// Should be not enumerable (circular)
	Object.defineProperty( this , 'root' , { value: this } ) ;

	if ( ! process.browser ) {
		// unknown case are produced when running REPL
		this.app = path.basename( process.argv[ 1 ] || '(unknown)' ) ;
		this.pid = process.pid ;
		this.hostname = os.hostname() ;
	}

	if ( config ) { this.configure( config ) ; }
}

module.exports = Logfella ;

// Backward compatibility
Logfella.create = ( ... args ) => new Logfella( ... args ) ;

Logfella.prototype.timeFormatter = require( './timeFormatter.js' ) ;
Logfella.prototype.messageFormatter = require( './messageFormatter.js' ) ;



var defaultLevelHash = {} ,
	defaultLevelArray = [ 'trace' , 'debug' , 'verbose' , 'info' , 'warning' , 'error' , 'fatal' , 'hdebug' ] ,
	defaultAvailableLevels = [] ;



( function() {
	var i , name ;

	var createShortHand = ( level , name_ ) => {
		Logfella.prototype[ name_ ] = function( ... args ) {
			// Early exit, if possible
			if ( ! this.perDomain && ( level < this.minLevel || level > this.maxLevel ) ) { return Promise.resolved ; }
			return this.log( level , ... args ) ;
		} ;
	} ;

	for ( i = 0 ; i < defaultLevelArray.length ; i ++ ) {
		name = defaultLevelArray[ i ] ;
		defaultLevelHash[ name ] = i ;
		defaultAvailableLevels.push( i ) ;
		defaultAvailableLevels.push( name ) ;
		createShortHand( i , name ) ;
	}
} )() ;



// Check if the current level is enable, userland
Logfella.prototype.checkLevel = function( level ) {
	if ( typeof level === 'string' ) {
		level = this.levelHash[ level ] ;
	}

	return level >= this.minLevel && level <= this.maxLevel ;
} ;



Logfella.defineOrConfig = function( name , config ) {
	if ( Logfella[ name ] ) {
		if ( Logfella[ name ] instanceof Logfella ) {
			Logfella[ name ].configure( config ) ;
		}
		else {
			throw new Error( "Logfella: '" + name + "' is reserved" ) ;
		}
	}
	else {
		Logfella[ name ] = new Logfella( config ) ;
	}
} ;



Logfella.prototype.use = function( domain ) {
	// Force a domain
	var logger = Object.create( this , {
		domain: { value: domain , enumerable: true }
	} ) ;

	return logger ;
} ;



Logfella.prototype.useHook = function( hook , monHook ) {
	// Force a hook
	var logger = Object.create( this , {
		hook: { value: hook , enumerable: true } ,
		monHook: { value: monHook , enumerable: true }
	} ) ;

	return logger ;
} ;



Logfella.prototype.setGlobalConfig =
Logfella.prototype.configure = function( config ) {
	var i , iMax ;

	if ( config.app ) { this.app = config.app ; }

	if ( config.minLevel !== undefined ) {
		if ( typeof config.minLevel === 'number' ) { this.minLevel = config.minLevel ; }
		else if ( typeof config.minLevel === 'string' ) { this.minLevel = this.levelHash[ config.minLevel ] ; }
	}

	if ( config.maxLevel !== undefined ) {
		if ( typeof config.maxLevel === 'number' ) { this.maxLevel = config.maxLevel ; }
		else if ( typeof config.maxLevel === 'string' ) { this.maxLevel = this.levelHash[ config.maxLevel ] ; }
	}

	if ( config.defaultDomain && typeof config.defaultDomain === 'string' ) { this.defaultDomain = config.defaultDomain ; }

	if ( config.overrideConsole !== undefined ) {
		if ( ! this.overrideConsole !== ! config.overrideConsole ) {
			if ( config.overrideConsole ) { this.replaceConsole() ; }
			else { this.restoreConsole() ; }
		}

		this.overrideConsole = !! config.overrideConsole ;
	}

	if ( config.monPeriod !== undefined ) {
		if ( ! config.monPeriod ) {
			this.monPeriod = null ;
			this.stopMon() ;
		}
		else if ( typeof config.monPeriod === 'number' ) {
			this.monPeriod = config.monPeriod ;
			this.startMon() ;
		}
	}

	if ( config.perDomain ) {
		for ( let k in config.perDomain ) {
			this.setDomainConfig( k , config.perDomain[ k ] ) ;
		}
	}

	if ( Array.isArray( config.transports ) ) {
		this.removeAllTransports() ;

		iMax = config.transports.length ;

		for ( i = 0 ; i < iMax ; i ++ ) {
			this.addTransport( config.transports[ i ].type , config.transports[ i ] ) ;
		}
	}
} ;



Logfella.prototype.disablePerDomainSettings = function() {
	this.perDomain = null ;
} ;



Logfella.prototype.setDomainConfig = function( domain , config ) {
	if ( ! this.perDomain ) { this.perDomain = {} ; }
	if ( ! this.perDomain[ domain ] ) { this.perDomain[ domain ] = {} ; }

	if ( config.minLevel ) {
		this.perDomain[ domain ].minLevel = typeof config.minLevel === 'string' ?
			this.levelHash[ config.minLevel ] :
			config.minLevel ;
	}

	if ( config.maxLevel ) {
		this.perDomain[ domain ].maxLevel = typeof config.maxLevel === 'string' ?
			this.levelHash[ config.maxLevel ] :
			config.maxLevel ;
	}
} ;



// log( level , domain , [code|meta] , formatedMessage , [arg1] , [arg2] , ... )
Logfella.prototype.log = function( level , ... args ) {
	var formatCount , formatedMessage , formatedMessageIndex , type , o , monModifier , perDomain ,
		levelName , domain , meta , code , messageData , isFormat , stack ,
		cache = null ;

	if ( typeof level === 'number' ) {
		if ( level >= this.levelArray.length ) { return Promise.resolved ; }
		levelName = this.levelArray[ level ] ;
	}
	else if ( typeof level === 'string' ) {
		levelName = level ;
		level = this.levelHash[ levelName ] ;
		if ( level === undefined ) { return Promise.resolved ; }
	}
	else {
		return Promise.resolved ;
	}

	if ( this.domain ) {
		domain = this.domain ;
		formatedMessageIndex = 0 ;
	}
	else {
		domain = typeof args[ 0 ] === 'string' ? args[ 0 ] : this.defaultDomain ;
		formatedMessageIndex = 1 ;
	}

	// Level management should come first for early exit

	// Per-domain filtering?
	if ( this.perDomain && ( perDomain = this.perDomain[ domain ] ) ) {
		if (
			level < ( perDomain.minLevel !== undefined ? perDomain.minLevel : this.minLevel ) ||
			level > ( perDomain.maxLevel !== undefined ? perDomain.maxLevel : this.maxLevel )
		) {
			return Promise.resolved ;
		}
	}
	else if ( level < this.minLevel || level > this.maxLevel ) {
		return Promise.resolved ;
	}

	// Check if there is a 'code/meta' argument
	if ( args.length > formatedMessageIndex + 1 ) {
		type = typeof args[ formatedMessageIndex ] ;

		if ( args[ formatedMessageIndex ] && type === 'object' ) {
			// This is a 'meta' argument
			meta = args[ formatedMessageIndex ] ;

			// Extract the 'code' property, if any...
			if ( 'code' in meta ) {
				code = meta.code ;
				delete meta.code ;
			}

			// Extract the 'mon' property, if any...
			if ( 'mon' in meta ) {
				monModifier = meta.mon ;
				delete meta.mon ;
			}

			formatedMessageIndex ++ ;
		}
		else if ( type === 'number' ) {
			// This is a 'code' argument
			code = args[ formatedMessageIndex ] ;
			formatedMessageIndex ++ ;
		}
		else if ( type === 'string' && args[ formatedMessageIndex ].indexOf( '%' ) === -1 ) {
			// This is a 'code' argument
			code = args[ formatedMessageIndex ] ;
			formatedMessageIndex ++ ;
		}

	}

	if ( level >= 4 ) {
		// The user may override and fucked up that, so we ensure we deal with numbers
		if ( level >= 5 ) { this.mon.errors = + this.mon.errors + 1 || 1 ; }
		else { this.mon.warnings = + this.mon.warnings + 1 || 1 ; }
	}

	if ( monModifier && typeof monModifier === 'object' ) {
		treeOps.autoReduce( this.mon , monModifier ) ;
	}

	// Call the mon hook, if any
	if ( this.monHook ) { this.monHook( this.mon ) ; }

	// If there is no transport, skip now... Should come after monitoring operation
	if ( ! this.logTransports.length ) { return Promise.resolved ; }


	formatedMessage = args[ formatedMessageIndex ] ;

	if ( typeof formatedMessage === 'string' ) {
		// Variable list of arguments
		formatCount = string.format.count( formatedMessage ) ;	// Count formated arguments

		if ( ! formatCount ) {
			messageData = formatedMessage ;
		}
		else {
			messageData = args.slice( formatedMessageIndex , formatedMessageIndex + 1 + formatCount ) ;
			isFormat = true ;
		}
	}
	else {
		messageData = formatedMessage ;
	}

	if ( level === 0 ) {
		// Add a stack trace for 'trace' level
		if ( process.browser ) {
			o = new Error() ;
		}
		else {
			o = {} ;
			Error.captureStackTrace( o , Logfella.prototype.trace ) ;

			if ( o.stack.indexOf( '\n' ) === -1 ) {
				// The Logfella#log have been called instead of Logfella#trace

				// For some reason, Error.captureStackTrace() do not work twice on the same object,
				// even if the 'stack' property is deleted.
				o = {} ;
				Error.captureStackTrace( o , Logfella.prototype.log ) ;
			}
		}

		stack = o.stack ;
	}

	var data = {
		level ,
		levelName ,
		domain ,
		meta ,
		code ,
		messageData ,
		isFormat ,
		stack ,
		app: this.app ,
		time: new Date() ,
		uptime: process.uptime() ,
		pid: this.pid ,
		hostname: this.hostname ,
		messageCache: {}
	} ;


	// Call the hook, if any
	if ( this.hook ) { this.hook( data ) ; }


	var eachTransport = transport => {
		if ( level < transport.minLevel || level > transport.maxLevel )  { return Promise.resolved ; }
		return transport.transport( data , cache ) ;
	} ;

	// Fast and common use-case: only one transport (avoid all Promise.all() machinery)
	if ( this.logTransports.length === 1 ) {
		return eachTransport( this.logTransports[ 0 ] ) ;
	}

	// Only active cache if there are more than one transport
	cache = {} ;

	return Promise.all( this.logTransports.map( eachTransport ) ) ;
} ;



Logfella.prototype.startMon = async function() {
	switch ( this.monStatus ) {
		case 'stopping' :
			// We have to wait until it is stopped
			await Promise.resolveTimeout( this.monPeriod ) ;
			return this.startMon() ;
		case 'stopped' :
			// Go!
			break ;
		case 'started' :
			// Already running
			return ;
	}

	if ( this.monStatus !== 'stopped' ) { return ; }
	this.monStatus = 'started' ;

	for ( ;; ) {
		await this.monFrame() ;
		await Promise.resolveTimeout( this.monPeriod ) ;

		switch ( this.monStatus ) {
			case 'stopping' :
				// We can now turn it into 'stopped'
				this.monStatus = 'stopped' ;
				return ;
			case 'stopped' :
				// Already stopped, return... (should never happen)
				return ;
			case 'started' :
				// Still running!
				break ;
		}
	}
} ;



Logfella.prototype.stopMon = function() {
	switch ( this.monStatus ) {
		case 'stopping' :
		case 'stopped' :
			return ;
		case 'started' :
			this.monStatus = 'stopping' ;
	}
} ;



Logfella.prototype.updateMon = function( monModifier ) {
	treeOps.autoReduce( this.mon , monModifier ) ;
} ;



// monFrame()
Logfella.prototype.monFrame = function() {
	if ( ! this.monTransports.length ) { return Promise.resolved ; }

	var cache = null ;

	var data = {
		level: null ,
		levelName: 'mon' ,
		app: this.app ,
		domain: this.domain || 'mon' ,
		time: new Date() ,
		uptime: process.uptime() ,
		pid: this.pid ,
		hostname: this.hostname ,
		mon: this.mon
	} ;

	// Fast and common use-case: only one transport (avoid all Promise.all() machinery)
	if ( this.monTransports.length === 1 ) {
		return this.monTransports[ 0 ].transport( data , cache ) ;
	}

	// Only active cache if there are more than one transport
	cache = {} ;

	return Promise.all( this.monTransports.map( transport => transport.transport( data , cache ) ) ) ;
} ;



Logfella.transports = {} ;



Logfella.prototype.addTransport = function( transport , config ) {
	var module_ , role , instance ;

	switch ( config.role ) {
		case 'mon' :
			role = 'monTransports' ;
			break ;
		case 'log' :
			role = 'logTransports' ;
			break ;
		default :
			role = 'logTransports' ;
			break ;
	}

	if ( typeof transport === 'string' ) {
		transport = transport[ 0 ].toUpperCase() + transport.slice( 1 ) ;

		if ( Logfella.transports[ transport ] === undefined && ! process.browser ) {
			try {
				// First try to get core transport
				module_ = require( './' + transport + '.transport.js' ) ;
			}
			catch ( error ) {
				try {
					// Then try to get a module
					module_ = require( 'logfella-' + string.camelCaseToDashed( transport ) + '-transport' ) ;
				}
				catch ( error_ ) {

					try {
						// Try to require the parent module: useful if Logfella is a devDependecy of a transport stand-alone module,
						// e.g.: unit tests of that transport.
						module_ = require( '../../../package.json' ) ;

						if ( module_.name === 'logfella-' + string.camelCaseToDashed( transport ) + '-transport' ) {
							module_ = require( '../../../' ) ;
						}
						else {
							// will be catched and throw
							throw null ;
						}
					}
					catch ( error__ ) {
						// Nothing could be loaded...
						// Should a logger log error? or not? That's a good question!!!
						throw new Error( "Logfella: can't load transport: " + transport ) ;
					}
				}
			}

			if ( ! ( module_.prototype instanceof CommonTransport ) ) {
				throw new Error( "Logfella: not an instance of CommonTranport: " + transport ) ;
			}

			Logfella.transports[ transport ] = module_ ;
		}

		transport = Logfella.transports[ transport ] ;
	}

	instance = new transport( this , config ) ;

	this[ role ].push( instance ) ;
} ;



Logfella.prototype.removeAllTransports = function() {
	var i , iMax ;

	for ( i = 0 , iMax = this.logTransports.length ; i < iMax ; i ++ ) { this.logTransports[ i ].shutdown() ; }
	for ( i = 0 , iMax = this.monTransports.length ; i < iMax ; i ++ ) { this.monTransports[ i ].shutdown() ; }

	this.logTransports = [] ;
	this.monTransports = [] ;
} ;



// This method should eventually become cross-platform
Logfella.setStackTraceLimit = function( depth ) {
	Error.stackTraceLimit = depth ;
} ;



var exitHandlersInstalled = false ;

if ( process.browser ) {
	// It does not make sense in browsers...
	Logfella.prototype.installExitHandlers = function() {} ;
}
else {
	Logfella.prototype.installExitHandlers = function() {
		var logger = this.root ;
		var domain = this.domain || 'logfella' ;

		if ( exitHandlersInstalled ) { return ; }
		exitHandlersInstalled = true ;

		process.on( 'asyncExit' , ( code , timeout , callback ) => {
			logger.info( domain , 'The process is about to exit within %ims with code %i...' , timeout , code ).then( callback ) ;
		} ) ;

		process.on( 'exit' , ( code ) => {
			logger.info( domain , 'The process is exiting with code %i...' , code ) ;
		} ) ;

		process.on( 'uncaughtException' , ( error ) => {
			if ( process.listenerCount( 'uncaughtException' ) <= 1 ) {
				// We are on our own
				logger.fatal( domain , 'Uncaught exception: %E' , error ).then( () => {
					// All underlying transports have finished, we can exit safely without losing logs...
					Promise.asyncExit( 1 ) ;
				} ) ;
			}
			else {
				// Another handler should have done something about that failure
				logger.fatal( domain , 'Uncaught exception: %E' , error ) ;
			}
		} ) ;

		process.on( 'SIGINT' , () => {
			if ( process.listenerCount( 'SIGINT' ) <= 1 ) {
				// We are on our own
				logger.info( domain , 'Received a SIGINT signal.' ).then( () => {
					// All underlying transports have finished, we can exit safely without losing logs...
					Promise.asyncExit( 130 ) ;
				} ) ;
			}
			else {
				// Another handler should have done something about that failure
				logger.info( domain , 'Received a SIGINT signal.' ) ;
			}
		} ) ;

		process.on( 'SIGTERM' , () => {
			if ( process.listenerCount( 'SIGTERM' ) <= 1 ) {
				// We are on our own
				logger.info( domain , 'Received a SIGTERM signal.' ).then( () => {
					// All underlying transports have finished, we can exit safely without losing logs...
					Promise.asyncExit( 143 ) ;
				} ) ;
			}
			else {
				// Another handler should have done something about that failure
				logger.info( domain , 'Received a SIGTERM signal.' ) ;
			}
		} ) ;

		process.on( 'SIGHUP' , () => {
			if ( process.listenerCount( 'SIGHUP' ) <= 1 ) {
				// We are on our own
				logger.info( domain , 'Received a SIGHUP signal.' ).then( () => {
					// All underlying transports have finished, we can exit safely without losing logs...
					Promise.asyncExit( 129 ) ;
				} ) ;
			}
			else {
				// Another handler should have done something about that failure
				logger.info( domain , 'Received a SIGHUP signal.' ) ;
			}
		} ) ;
	} ;
}



var consoleBackup = {
	trace: console.trace ,
	log: console.log ,
	info: console.info ,
	warn: console.warn ,
	error: console.error ,
	dir: console.dir
} ;



function consoleReplacement( type , domain , ... args ) {
	var util = require( 'util' ) ;
	var message = string.escape.format( util.format( ... args ) ) ;
	return this[ type ]( domain , message ) ;
}



Logfella.prototype.replaceConsole = function() {
	console.trace = consoleReplacement.bind( this , 'trace' , 'console' ) ;
	console.log = consoleReplacement.bind( this , 'info' , 'console' ) ;
	console.info = consoleReplacement.bind( this , 'info' , 'console' ) ;
	console.warn = consoleReplacement.bind( this , 'warning' , 'console' ) ;
	console.error = consoleReplacement.bind( this , 'error' , 'console' ) ;
} ;



Logfella.prototype.restoreConsole = function() {
	console.trace = consoleBackup.trace ;
	console.log = consoleBackup.log ;
	console.info = consoleBackup.info ;
	console.warn = consoleBackup.warn ;
	console.error = consoleBackup.error ;
} ;



// Useful for third-party lib to validate the config
Logfella.configSchema = {
	type: 'strictObject' ,
	default: {} ,
	properties: {
		minLevel: { in: defaultAvailableLevels , default: 3 } ,
		maxLevel: { in: defaultAvailableLevels , default: 7 } ,
		defaultDomain: { type: 'string' , default: 'no-domain' } ,
		overrideConsole: { type: 'boolean' , default: false } ,
		monPeriod: { type: 'number' , default: null } ,
		perDomain: {
			type: 'strictObject' ,
			default: null ,
			of: {
				type: 'strictObject' ,
				extraProperties: true ,
				properties: {
					minLevel: { in: defaultAvailableLevels , default: 0 } ,
					maxLevel: { in: defaultAvailableLevels , default: 7 }
				}
			}
		} ,
		transports: {
			type: 'array' ,
			default: [] ,
			of: {
				type: 'strictObject' ,
				extraProperties: true ,
				properties: {
					type: { type: 'string' } ,
					role: { in: [ 'log' , 'mon' ] , default: 'log' } ,
					minLevel: { in: defaultAvailableLevels , default: 0 } ,
					maxLevel: { in: defaultAvailableLevels , default: 7 } ,
					messageFormatter: [ { type: 'function' } , { type: 'string' , optional: true } ] ,
					timeFormatter: [ { type: 'function' } , { type: 'string' , default: 'dateTime' } ] ,
					color: { type: 'boolean' , default: false }
				}
			}
		}
	}
} ;



// Global logger

Logfella.global = new Logfella() ;
Logfella.global.configure( { minLevel: 'trace' } ) ;

if ( process.browser ) {
	Logfella.transports.BrowserConsole = require( './BrowserConsole.transport.js' ) ;
	Logfella.global.addTransport( 'BrowserConsole' , { minLevel: 'trace' } ) ;
	window.Logfella = Logfella ;
}
else {
	Logfella.global.addTransport( 'console' , { minLevel: 'trace' , color: true } ) ;
	//Logfella.global.addTransport( 'files' , 'trace' , { path: __dirname + '/test/log' } ) ;
}


}).call(this,require('_process'))
},{"../../../":undefined,"../../../package.json":undefined,"./BrowserConsole.transport.js":1,"./messageFormatter.js":3,"./timeFormatter.js":4,"_process":46,"kung-fig-tree-ops":5,"logfella-common-transport":6,"os":44,"path":45,"seventh":14,"string-kit":27,"util":49}],3:[function(require,module,exports){
/*
	Logfella

	Copyright (c) 2015 - 2019 Cédric Ronvel

	The MIT License (MIT)

	Permission is hereby granted, free of charge, to any person obtaining a copy
	of this software and associated documentation files (the "Software"), to deal
	in the Software without restriction, including without limitation the rights
	to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
	copies of the Software, and to permit persons to whom the Software is
	furnished to do so, subject to the following conditions:

	The above copyright notice and this permission notice shall be included in all
	copies or substantial portions of the Software.

	THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
	IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
	FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
	AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
	LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
	OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
	SOFTWARE.
*/

"use strict" ;



const string = require( 'string-kit' ) ;
const tree = require( 'tree-kit' ) ;



var format = {} , formatColor = {} ;
tree.extend( { deep: true } , formatColor , string.format.default , { format: string.formatMethod , color: true } ) ;
tree.extend( { deep: true } , format , string.format.default , { format: string.formatMethod } ) ;
delete format.markup ;	// Turn style markup off



function message( data , color ) {
	var k , messageString = '' ;

	if ( data.mon ) {
		messageString = '\n' ;

		if ( color ) {
			for ( k in data.mon ) {
				messageString += string.ansi.green + k + string.ansi.reset + ': ' +
					string.ansi.cyan + data.mon[ k ] + string.ansi.reset + '\n' ;
			}
		}
		else {
			for ( k in data.mon ) { messageString += k + ': ' + data.mon[ k ] + '\n' ; }
		}
	}
	else if ( Array.isArray( data.messageData ) && data.isFormat ) {
		//if ( color ) { messageString = string.ansi.italic + string.formatMethod.apply( { color: true } , data.messageData ) ; }
		//else { messageString = string.formatMethod.apply( { color: false } , data.messageData ) ; }

		messageString = string.formatMethod.apply( color ? formatColor : format , data.messageData ) ;
	}
	else if ( data.messageData instanceof Error ) {
		messageString = string.inspectError( { style: color ? 'color' : 'none' } , data.messageData ) ;
	}
	else if ( typeof data.messageData !== 'string' ) {
		messageString = string.inspect( { style: color ? 'color' : 'none' } , data.messageData ) ;
	}
	else {
		// Even if messageData is not an array, it may contains markup, so it should be formated anyway
		//messageString = data.messageData ;
		messageString = string.formatMethod.call( color ? formatColor : format , data.messageData ) ;
	}

	return messageString ;
}



const symbols = [
	'▄' , '▋' , '┃' , '━' , '╋' , '●' , '■' , '◤' , '◢' , '▲' , '▼' , '◀' , '▶' , '★' , '☀' , '♠' , '♥' , '♦' , '♣'
	//, '☗' , '♚' , '♛' , '♜' , '♝' , '♞' , '♟'
] ;

//const fgColors = [ 'red' , 'green' , 'yellow' , 'blue' , 'magenta' , 'cyan' , 'brightRed' , 'brightGreen' , 'brightYellow' , 'brightBlue' , 'brightMagenta' , 'brightCyan' ] ;
//const bgColors = [ 'bgRed' , 'bgGreen' , 'bgYellow' , 'bgBlue' , 'bgMagenta' , 'bgCyan' , 'bgBrightRed' , 'bgBrightGreen' , 'bgBrightYellow' , 'bgBrightBlue' , 'bgBrightMagenta' , 'bgBrightCyan' ] ;
const fgColors = [ 'white' , 'brightRed' , 'brightGreen' , 'brightYellow' , 'brightBlue' , 'brightMagenta' , 'brightCyan' ] ;
const bgColors = [ 'bgBlack' , 'bgRed' , 'bgGreen' , 'bgYellow' , 'bgBlue' , 'bgMagenta' , 'bgCyan' ] ;



// Naive CRC-like algorithm
function hashSymbol( value ) {
	var i , iMax , hash = 0 , output , offset ;

	value = '' + value ;

	// At least 3 passes
	offset = 3 * 16 / value.length ;

	for ( i = 0 , iMax = value.length ; i < iMax ; i ++ ) {
		hash ^= value.charCodeAt( i ) << ( ( i * offset ) % 16 ) ;
		//hash += value.charCodeAt( i ) ;
		//hash += value.charCodeAt( i ) * ( i + 1 ) ;
	}

	output = symbols[ hash % symbols.length ] ;
	hash = Math.floor( hash / symbols.length ) ;

	output = string.ansi[ fgColors[ hash % fgColors.length ] ] + output ;
	hash = Math.floor( hash / fgColors.length ) ;

	output = string.ansi[ bgColors[ hash % bgColors.length ] ] + output ;
	hash = Math.floor( hash / bgColors.length ) ;

	output += string.ansi.reset ;

	return output ;
}



// The default message formater
exports.text = function( data , cache ) {
	var cacheKey , metaKeys , first ,
		levelString = '' , timeString = '' , domainString = '' , idString = '' ,
		codeString = '' , metaString = '' , messageString = '' , stackString = '' ,
		symbolString = this.symbol ? '  ' : '' ,
		separatorString = '' ;

	if ( cache ) {
		cacheKey = 'text-' +
			( this.color ? 'c-' : '!c-' ) +
			( this.symbol ? 's-' : '!s-' ) +
			( this.indent ? 'i-' : '!i-' ) +
			( this.includeIdMeta ? 'im-' : '!im-' ) +
			( this.includeCommonMeta ? 'cm-' : '!cm-' ) +
			( this.includeUserMeta ? 'um-' : '!um-' ) +
			this.timeFormatter.name ;

		//console.log( "<<< Cache key:" , cacheKey ) ;

		// Cache hit!
		if ( cache[ cacheKey ] ) {
			//console.log( ">>> Cache hit!" ) ;
			return cache[ cacheKey ] ;
		}
	}

	// Build the message
	messageString = message( data , this.color ) ;

	// Message indentation
	if ( this.indent ) {
		messageString = messageString.replace( /\n/g , '\n    ' ) ;
	}

	// Final style reset
	//if ( this.color ) { messageString += string.ansi.reset ; }


	// Include built-in Meta
	if ( this.includeCommonMeta ) {
		timeString = this.color ?
			string.ansi.brightCyan + this.timeFormatter( data.time ) + string.ansi.reset + ' ' :
			this.timeFormatter( data.time ) + ' ' ;

		if ( data.domain && typeof data.domain === 'string' ) {
			domainString = this.color ?
				string.ansi.magenta + '<' + data.domain + '>' + string.ansi.reset + ' ' :
				'<' + data.domain + '> ' ;
		}

		if ( data.code !== undefined ) {
			codeString = this.color ?
				string.ansi.green + '#' + data.code + string.ansi.reset + ' ' :
				'#' + data.code + ' ' ;
		}

		// Five letter levelName
		switch ( data.levelName ) {
			case 'trace' :
				levelString = this.color ?
					string.ansi.brightBlack + '[TRACE]' + string.ansi.reset + ' ' :
					'[TRACE] ' ;
				break ;
			case 'debug' :
				levelString = this.color ?
					string.ansi.dim + '[DEBUG]' + string.ansi.reset + ' ' :
					'[DEBUG] ' ;
				break ;
			case 'verbose' :
				levelString = this.color ?
					string.ansi.blue + '[VERB.]' + string.ansi.reset + ' ' :
					'[VERB.] ' ;
				break ;
			case 'info' :
				levelString = this.color ?
					string.ansi.brightWhite + '[INFO.]' + string.ansi.reset + ' ' :
					'[INFO.] ' ;
				break ;
			case 'warning' :
				levelString = this.color ?
					string.ansi.brightYellow + '[WARN.]' + string.ansi.reset + ' ' :
					'[WARN.] ' ;
				break ;
			case 'error' :
				levelString = this.color ?
					string.ansi.red + '[ERROR]' + string.ansi.reset + ' ' :
					'[ERROR] ' ;
				break ;
			case 'fatal' :
				levelString = this.color ?
					string.ansi.brightRed + string.ansi.bold + '[FATAL]' + string.ansi.reset + ' ' :
					'[FATAL] ' ;
				break ;
			case 'hdebug' :
				levelString = this.color ?
					string.ansi.brightGreen + string.ansi.bold + '[HDBUG]' + string.ansi.reset + ' ' :
					'[HDBUG] ' ;
				break ;
			case 'mon' :
				levelString = this.color ?
					string.ansi.cyan + '[ MON ]' + string.ansi.reset + ' ' :
					'[ MON ] ' ;
				break ;
			default :
				levelString = this.color ?
					string.ansi.dim + '[' + ( data.levelName + '.    ' ).slice( 0 , 5 ) + ']' + string.ansi.reset + ' ' :
					'[' + ( data.levelName + '.    ' ).slice( 0 , 5 ) + '] ' ;
		}

	}


	// Include process Meta
	if ( this.includeIdMeta ) {
		idString = this.color ?
			string.ansi.yellow + data.hostname + string.ansi.brightBlack + '(' + data.pid + ')' + string.ansi.reset + ' ' :
			data.hostname + '(' + data.pid + ') ' ;
	}


	// Include custom Meta
	if ( this.includeUserMeta && data.meta && ( metaKeys = Object.keys( data.meta ) ).length ) {

		metaString += this.color ?
			string.ansi.blue + '[' :
			'[' ;

		first = true ;

		metaKeys.forEach( metaKey => {
			if ( ! first ) {
				metaString += ' ' ;
				//metaString += string.ansi.brightBlack + '|' ;
			}

			first = false ;

			metaString += this.color ?
				string.ansi.yellow + metaKey + string.ansi.brightWhite + ':' :
				metaKey + ':' ;

			switch ( typeof data.meta[ metaKey ] ) {
				case 'number' :
					metaString += this.color ?
						string.ansi.cyan + data.meta[ metaKey ] :
						data.meta[ metaKey ] ;
					break ;
				case 'string' :
					metaString += this.color ?
						string.ansi.blue + string.ansi.italic + string.escape.control( data.meta[ metaKey ] ) + string.ansi.reset :
						JSON.stringify( data.meta[ metaKey ] ) ; // Because we need to fully escape both control chars and double-quotes, and enclose it inside double quotes
					break ;
				case 'object' :
					metaString += this.color ?
						string.ansi.magenta + JSON.stringify( data.meta[ metaKey ] ) :
						JSON.stringify( data.meta[ metaKey ] ) ;
					break ;
				default :
					metaString += this.color ?
						string.ansi.cyan + data.meta[ metaKey ] :
						'(' + data.meta[ metaKey ] + ')' ;
			}
		} ) ;

		metaString += this.color ?
			string.ansi.blue + ']' + string.ansi.reset + ' ' :
			'] ' ;

		if ( data.meta.id && this.symbol ) {
			symbolString = hashSymbol( data.meta.id ) + ' ' ;
		}
	}


	// Separator, if needed
	if ( this.includeIdMeta || this.includeCommonMeta || this.includeUserMeta ) {
		separatorString = this.color ?
			string.ansi.brightBlack + '--' + string.ansi.reset + ' ' :
			'-- ' ;
	}

	if ( data.stack !== undefined ) {
		stackString = '\n' + string.inspectStack( { style: this.color ? 'color' : 'none' } , data.stack ) ;
	}

	// Construct the whole message string...
	messageString = symbolString + levelString + timeString + idString + domainString + codeString + metaString + separatorString + messageString + stackString ;

	if ( cache ) { cache[ cacheKey ] = messageString ; }

	return messageString ;
} ;



// The JSON message formater
exports.json = function( data , cache ) {
	var cacheKey , str ;

	if ( cache ) {
		cacheKey = 'json-' + ( this.color ? 'c-' : '!c-' ) ;
		//console.log( "<<< Cache key:" , cacheKey ) ;

		// Cache hit!
		if ( cache[ cacheKey ] ) {
			//console.log( ">>> Cache hit!" ) ;
			return cache[ cacheKey ] ;
		}
	}

	str = JSON.stringify( {
		app: data.app ,
		time: data.time.getTime() ,
		uptime: data.uptime ,
		pid: data.pid ,
		hostname: data.hostname ,
		domain: data.domain ,
		level: data.level ,
		levelName: data.levelName ,
		code: data.code ,
		mon: data.mon || undefined ,
		meta: data.meta || undefined ,
		messageData: data.mon ? undefined : data.messageData ,
		isFormat: data.isFormat ,
		message: data.mon ? undefined : message( data , this.color )
	} ) ;

	if ( cache ) { cache[ cacheKey ] = str ; }

	return str ;
} ;


},{"string-kit":27,"tree-kit":38}],4:[function(require,module,exports){
/*
	Logfella

	Copyright (c) 2015 - 2019 Cédric Ronvel

	The MIT License (MIT)

	Permission is hereby granted, free of charge, to any person obtaining a copy
	of this software and associated documentation files (the "Software"), to deal
	in the Software without restriction, including without limitation the rights
	to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
	copies of the Software, and to permit persons to whom the Software is
	furnished to do so, subject to the following conditions:

	The above copyright notice and this permission notice shall be included in all
	copies or substantial portions of the Software.

	THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
	IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
	FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
	AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
	LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
	OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
	SOFTWARE.
*/

"use strict" ;



// Force a leading zero, so number have at least 2 digits
function leadingZero( num ) { return num >= 10 ? num : '0' + num ; }

// Full time formater, with date & time in ms
exports.dateTimeMs = function( timeObject ) {
	return timeObject.getUTCFullYear() + '-' + leadingZero( timeObject.getUTCMonth() + 1 ) + '-' + leadingZero( timeObject.getUTCDate() ) +
		' ' + leadingZero( timeObject.getUTCHours() ) + ':' + leadingZero( timeObject.getUTCMinutes() ) + ':' + leadingZero( timeObject.getUTCSeconds() ) +
		'.' + ( timeObject.getUTCMilliseconds() / 1000 ).toFixed( 3 ).slice( 2 , 5 ) ;
} ;

// Date & time in s
exports.dateTime = function( timeObject ) {
	return timeObject.getUTCFullYear() + '-' + leadingZero( timeObject.getUTCMonth() + 1 ) + '-' + leadingZero( timeObject.getUTCDate() ) +
		' ' + leadingZero( timeObject.getUTCHours() ) + ':' + leadingZero( timeObject.getUTCMinutes() ) + ':' + leadingZero( timeObject.getUTCSeconds() ) ;
} ;

// Time in ms
exports.timeMs = function( timeObject ) {
	return leadingZero( timeObject.getUTCHours() ) + ':' + leadingZero( timeObject.getUTCMinutes() ) + ':' + leadingZero( timeObject.getUTCSeconds() ) +
		'.' + ( timeObject.getUTCMilliseconds() / 1000 ).toFixed( 3 ).slice( 2 , 5 ) ;
} ;

// Time in s
exports.time = function( timeObject ) {
	return leadingZero( timeObject.getUTCHours() ) + ':' + leadingZero( timeObject.getUTCMinutes() ) + ':' + leadingZero( timeObject.getUTCSeconds() ) ;
} ;


},{}],5:[function(require,module,exports){
/*
	Kung Fig Tree Ops

	Copyright (c) 2015 - 2018 Cédric Ronvel

	The MIT License (MIT)

	Permission is hereby granted, free of charge, to any person obtaining a copy
	of this software and associated documentation files (the "Software"), to deal
	in the Software without restriction, including without limitation the rights
	to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
	copies of the Software, and to permit persons to whom the Software is
	furnished to do so, subject to the following conditions:

	The above copyright notice and this permission notice shall be included in all
	copies or substantial portions of the Software.

	THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
	IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
	FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
	AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
	LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
	OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
	SOFTWARE.
*/

"use strict" ;



var treeOps = {} ;
module.exports = treeOps ;



// Reduce then transform to object
treeOps.reduceToObject = function reduceToObject( object , ... args ) {
	//return treeOps.toObject( treeOps.reduce.apply( this , arguments ) ) ;
	return treeOps.toObject( treeOps.reduce( object , ... args ) ) ;
} ;



// Remove all treeOps mark and operators, transform to a regular object with values
treeOps.toObject = function toObject( object ) {
	if ( ! isPlainObject( object ) ) { return object ; }

	var i , iMax , parts , value ,
		output = {} ,
		keys = Object.keys( object ) ;

	for ( i = 0 , iMax = keys.length ; i < iMax ; i ++ ) {
		parts = this.splitOpKey( keys[ i ] ) ;

		// Skip operators
		if ( parts.operator ) { continue ; }

		value = object[ keys[ i ] ] ;

		if ( isPlainObject( value ) ) { value = treeOps.toObject( value ) ; }

		output[ parts.baseKey ] = value ;
	}

	return output ;
} ;



// Stack multiple object structure into one new object, do not apply operators
treeOps.stack = function stack( ... args ) {
	var i , iMax = args.length ,  stacked = {} ;

	for ( i = 0 ; i < iMax ; i ++ ) {
		//if ( ! args[ i ] || typeof args[ i ] !== 'object' || Array.isArray( args[ i ] ) ) { continue ; }
		if ( ! isPlainObject( args[ i ] ) ) { continue ; }
		this.stackInto( args[ i ] , stacked ) ;
	}

	return stacked ;
} ;



// Stack multiple object structure into the first object, do not apply operators
treeOps.autoStack = function autoStack( stacked , ... args ) {
	//if ( ! stacked || typeof stacked !== 'object' || Array.isArray( stacked ) ) { return stacked ; }
	if ( ! isPlainObject( stacked ) ) { return stacked ; }

	var i , iMax = args.length ;

	for ( i = 0 ; i < iMax ; i ++ ) {
		//if ( ! args[ i ] || typeof args[ i ] !== 'object' || Array.isArray( args[ i ] ) ) { continue ; }
		if ( ! isPlainObject( args[ i ] ) ) { continue ; }
		this.stackInto( args[ i ] , stacked ) ;
	}

	return stacked ;
} ;



// Stack the source into the target, do not apply operators
treeOps.stackInto = function stackInto( source , target ) {
	var i , iMax , parts , foreachKey , nonForeachKey , key , keys = Object.keys( source ) ;

	iMax = keys.length ;

	for ( i = 0 ; i < iMax ; i ++ ) {
		key = keys[ i ] ;

		// Skip empty keys, avoid infinite recursions, also the empty operator is not allowed on the root object
		if ( ! key ) { continue ; }

		parts = this.splitOpKey( key ) ;

		if ( parts.foreach ) {
			if ( Array.isArray( source[ key ] ) ) {
				nonForeachKey = key[ 0 ] === '(' ?
					'(' + key.slice( 2 ) :
					key.slice( 1 ) ;

				//console.log( "source is array, operator:" , parts.operator , nonForeachKey , target[ nonForeachKey ] ) ;
				if ( target[ nonForeachKey ] !== undefined ) {
					//console.log( "target non-foreach operator exist" ) ;
					if ( Array.isArray( target[ key ] ) ) { target[ key ].push( target[ nonForeachKey ] ) ; }
					else { target[ key ] = [ target[ nonForeachKey ] ] ; }
					delete target[ nonForeachKey ] ;
				}

				if ( Array.isArray( target[ key ] ) ) { target[ key ] = target[ key ].concat( source[ key ] ) ; }
				else { target[ key ] = source[ key ] ; }
			}

			continue ;
		}

		foreachKey = key[ 0 ] === '(' ?
			'(#' + key.slice( 1 ) :
			'#' + key ;

		if ( Array.isArray( target[ foreachKey ] ) ) {
			if ( target[ key ] === undefined ) {
				target[ foreachKey ].push( source[ key ] ) ;
			}
			else {
				target[ foreachKey ] = target[ foreachKey ].concat( [ target[ key ] , source[ key ] ] ) ;
			}

			delete target[ key ] ;
		}
		else if ( target[ key ] === undefined ) {
			target[ key ] = source[ key ] ;
		}
		else {
			target[ foreachKey ] = [ target[ key ] , source[ key ] ] ;
			delete target[ key ] ;
		}
	}
} ;



// Reduce a previously stacked (or not) object by applying operators.
// Do not modify the original object, create a brand new one.
// In case of multiple arguments, they are first “stacked” into a recipient object.
// Applied operators are removed.
treeOps.reduce = function reduce( object , ... args ) {
	//if ( ! object || typeof object !== 'object' || Array.isArray( object ) ) { return object ; }
	if ( ! isPlainObject( object ) ) { return object ; }

	//object = this.stack.apply( this , arguments ) ;
	object = this.stack( object , ... args ) ;

	//console.log( "reduce after autoStack():" , require('string-kit').inspect( {style:'color',depth:10},object ) ) ;
	return this.reduceObject( object , [ object ] ) ;
} ;



// Reduce a previously stacked (or not) object by applying operators.
// In case of multiple arguments, they are first “autoStacked” into the first one before the first one is reduced.
// Applied operators are removed.
treeOps.autoReduce = function autoReduce( object , ... args ) {
	//if ( ! object || typeof object !== 'object' || Array.isArray( object ) ) { return object ; }
	if ( ! isPlainObject( object ) ) { return object ; }

	//if ( args.length > 1 ) { this.autoStack.apply( this , arguments ) ; }
	if ( args.length > 0 ) { this.autoStack( object , ... args ) ; }

	//console.log( "autoReduce after autoStack():" , require('string-kit').inspect( {style:'color',depth:10},object ) ) ;
	return this.reduceObject( object , [ object ] ) ;
} ;



// Reduce one object
treeOps.reduceObject = function reduceObject( object , antiCircularObjectList ) {
	var i , iMax , parts , ops = [] , operands , baseKey , key , keys = Object.keys( object ) ;

	iMax = keys.length ;

	// First, list all operations
	for ( i = 0 ; i < iMax ; i ++ ) {
		// Skip empty keys, avoid infinite recursions, also the empty operator is not allowed on the root object.
		// Also skip property with undefined value, undefined is the same as no property in the treeOps world.
		if ( ! keys[ i ] || object[ keys[ i ] ] === undefined ) { delete object[ keys[ i ] ] ; continue ; }

		parts = this.splitOpKey( keys[ i ] ) ;
		//console.log( "'" + parts.operator + "'" ) ;
		parts.rank = this.treeOperators[ parts.operator ].rank ;
		ops.push( parts ) ;
	}

	// Sort all operations, so they will be applied in the correct order
	ops.sort( sortOperations ) ;

	// Apply anything
	for ( i = 0 , iMax = ops.length ; i < iMax ; i ++ ) {
		baseKey = ops[ i ].baseKey ;
		key = ops[ i ].key ;

		if ( ! baseKey ) {
			// We want to combine with the root object, create a temporary clone

			//console.log( ">>> no basekey!" ) ;
			object[''] = {} ;
			this.assignObject( object[''] , object ) ;

			// Delete the operator about to be applied to from the clone, delete self-reference
			delete object[''][ key ] ;
			delete object[''][''] ;
		}

		if ( ops[ i ].foreach ) {
			if ( ! Array.isArray( object[ key ] ) ) {
				// This is a bad foreach key, due to a userland bad entry: remove that key and move forward.
				delete object[ key ] ;
				continue ;
			}

			object[ baseKey ] = this.treeOperators[ ops[ i ].operator ].reduce.call(
				this ,
				object[ baseKey ] ,
				object[ key ]
			) ;

			if ( object[ baseKey ] === undefined ) { delete object[ baseKey ] ; }

			if ( object[ key ].length === 0 ) { delete object[ key ] ; }
			else if ( object[ key ].length === 1 ) { object[ key.slice( 1 ) ] = object[ key ][ 0 ] ; delete object[ key ] ; }
		}
		else if ( ops[ i ].operator ) {
			operands = [ object[ key ] ] ;

			//console.log( ">>> before" ) ;
			//console.log( ">>> " , ops[ i ].operator ) ;
			object[ baseKey ] = this.treeOperators[ ops[ i ].operator ].reduce.call(
				this ,
				object[ baseKey ] ,
				operands
			) ;
			//console.log( ">>> after" ) ;

			if ( object[ baseKey ] === undefined ) { delete object[ baseKey ] ; }

			if ( operands.length === 0 ) { delete object[ key ] ; }
		}

		if (
			//object[ baseKey ] && typeof object[ baseKey ] === 'object' && ! Array.isArray( object[ baseKey ] ) &&
			isPlainObject( object[ baseKey ] ) &&
			antiCircularObjectList.indexOf( object[ baseKey ] ) === -1
		) {
			antiCircularObjectList.push( object[ baseKey ] ) ;
			this.reduceObject( object[ baseKey ] , antiCircularObjectList ) ;
		}

		if ( ! baseKey ) {
			// We have combined with the root object, assign the clone to the root

			//if ( object[''] && typeof object[''] === 'object' && ! Array.isArray( object[''] ) )
			if ( isPlainObject( object[''] ) ) {
				// The object ref has changed, but we cannot blindly assign object=object['']
				// because the parent object will still refer to the old one
				this.assignObject( object , object[''] ) ;
			}

			delete object[''] ;

			// Operations on the root object are typically unsafe: some remaining operations may had gone
			// and some new one should be created.
			// We have to run again reduceObject() for the whole newly assigned object.

			return this.reduceObject( object , antiCircularObjectList ) ;
		}
	}

	return object ;
} ;



function sortOperations( a , b ) {
	// First, the operator rank is checked,
	// then root object operations come last,
	// and finally 'foreach' operations come first
	return ( a.rank - b.rank ) ||
		( ( a.baseKey ? 0 : 1 ) - ( b.baseKey ? 0 : 1 ) ) ||
		( ( a.foreach ? 0 : 1 ) - ( b.foreach ? 0 : 1 ) ) ;
}



function isPlainObject( value ) {
	var proto ;

	return value &&
		typeof value === 'object' &&
		( ( proto = Object.getPrototypeOf( value ) ) === Object.prototype || proto === null ) ;
}



// Those operators do not need to be inside ()
treeOps.reservedOperators = {
//	'@': true ,	// needed?
	'+': true ,
	'-': true ,
	'*': true ,
	'/': true ,
	'*>': true ,
	'<*': true ,
	'*>>': true ,
	'<<*': true ,
	'+>': true ,
	'<+': true
} ;

// Expand them all with the 'foreach' prefix (#)
Object.keys( treeOps.reservedOperators ).forEach( ( k ) => {
	treeOps.reservedOperators[ '#' + k ] = true ;
} ) ;



treeOps.reservedKeyStart = {
//	'@': true ,	// needed?
	'#': true ,
	'(': true ,
	'+': true ,
	'-': true ,
	'*': true ,
	'/': true ,
	'<': true ,
	'?': true ,
	'!': true ,
	'^': true
} ;



// NOTE: it MUST be efficient, hence the strange switch-case hell

treeOps.splitOpKey = function splitOpKey( key ) {
	var i , iMax , opkey = key , splitted , foreach = false ;

	if ( opkey[ 0 ] === '(' ) {
		opkey = key.slice( 1 ) ;

		if ( opkey[ 0 ] === '#' ) {
			foreach = true ;
			opkey = opkey.slice( 1 ) ;
		}

		for ( i = 0 , iMax = opkey.length ; i < iMax && opkey[ i ] !== ')' ; i ++ ) { /* empty */ }

		splitted = {
			operator: opkey.slice( 0 , i ) , baseKey: opkey.slice( i + 1 ) , key: key
		} ;
	}
	else {
		if ( opkey[ 0 ] === '#' ) {
			foreach = true ;
			opkey = opkey.slice( 1 ) ;
		}

		switch ( opkey[ 0 ] ) {
			/*
			case '$' :
				splitted = { operator: '$' , baseKey: opkey.slice( 1 ) , key: key } ;
				break ;
			*/
			case '+' :
				switch ( opkey[ 1 ] ) {
					case '>' :
						splitted = {
							operator: '+>' , baseKey: opkey.slice( 2 ) , key: key
						} ;
						break ;
					default :
						splitted = {
							operator: '+' , baseKey: opkey.slice( 1 ) , key: key
						} ;
				}
				break ;
			case '-' :
				splitted = {
					operator: '-' , baseKey: opkey.slice( 1 ) , key: key
				} ;
				break ;
			case '*' :
				switch ( opkey[ 1 ] ) {
					case '>' :
						switch ( opkey[ 2 ] ) {
							case '>' :
								splitted = {
									operator: '*>>' , baseKey: opkey.slice( 3 ) , key: key
								} ;
								break ;
							default :
								splitted = {
									operator: '*>' , baseKey: opkey.slice( 2 ) , key: key
								} ;
						}
						break ;
					default :
						splitted = {
							operator: '*' , baseKey: opkey.slice( 1 ) , key: key
						} ;
				}
				break ;
			case '/' :
				splitted = {
					operator: '/' , baseKey: opkey.slice( 1 ) , key: key
				} ;
				break ;
			case '<' :
				switch ( opkey[ 1 ] ) {
					case '<' :
						switch ( opkey[ 2 ] ) {
							case '*' :
								splitted = {
									operator: '<<*' , baseKey: opkey.slice( 3 ) , key: key
								} ;
								break ;
							default :
								splitted = {
									operator: '' , baseKey: opkey , key: key
								} ;
						}
						break ;
					case '*' :
						splitted = {
							operator: '<*' , baseKey: opkey.slice( 2 ) , key: key
						} ;
						break ;
					case '+' :
						splitted = {
							operator: '<+' , baseKey: opkey.slice( 2 ) , key: key
						} ;
						break ;
					case '^' :
						splitted = {
							operator: '<^' , baseKey: opkey.slice( 2 ) , key: key
						} ;
						break ;
					default :
						splitted = {
							operator: '' , baseKey: opkey , key: key
						} ;
				}
				break ;
			case '^' :
				splitted = {
					operator: '^' , baseKey: opkey.slice( 1 ) , key: key
				} ;
				break ;
			//case '@' :
			//	/!\ Typically, this should never been encountered here, but solved at file loading
			//	splitted = { operator: '@' , baseKey: opkey.slice( 1 ) , key: key } ;
			default :
				splitted = {
					operator: '' , baseKey: opkey , key: key
				} ;
		}
	}

	splitted.foreach = foreach ;
	splitted.fullOperator = foreach ? '#' + splitted.operator : splitted.operator ;

	return splitted ;
} ;



treeOps.assignObject = function assignObject( target , source ) {
	var k ;

	for ( k in target ) { delete target[ k ] ; }
	for ( k in source ) { target[ k ] = source[ k ] ; }
} ;



/*
ASCII: &~#{}()[]-|`\_^°+=$%><*?,;.:/!
ASCII 8bits: §«»

# foreach prefix: the operand is an array, the operator should be applied to each element

+ add
- substract
* multiply
/ divide
+> append (string, array)
<+ prepend (string, array)
*> merge after (object), i.e. overwrite
<* merge before (object), i.e. do not overwrite
*>> merge after, lesser priority
<<* merge before, lesser priority

Not implemented yet / not specified:
*+> merge after (object), i.e. overwrite, use concat after when possible
<+* merge before (object), i.e. do not overwrite, use concat before when possible
$ global reference/link
?: set if it does not exist (define)?
!: set if it exists (rewrite)?
! delete?
_ gettext?
^ pow
<^ exp (the arg is the base, the existing key is the exponent)
*/

treeOps.treeOperators = {} ;

var rank = 0 ;

// The order matter: it is sorted from the highest to the lowest priority

// key: the full key, prepended by the operator
// baseKey: the key without the operator

// Assign operator (aka empty operator)
treeOps.treeOperators[''] = {
	rank: rank ++ ,
	reduce: function( existing , operands ) {
		var i , iMax = operands.length ;

		for ( i = 0 ; i < iMax ; i ++ ) {
			if (
				//existing && typeof existing === 'object' && ! Array.isArray( existing ) &&
				//operands[ i ] && typeof operands[ i ] === 'object' && ! Array.isArray( operands[ i ] )
				isPlainObject( existing ) && isPlainObject( operands[ i ] )
			) {
				// Both are object: autoReduce
				this.autoReduce( existing , operands[ i ] ) ;
			}
			else {
				// One of them is not an object: assign
				existing = operands[ i ] ;
			}
		}

		operands.length = 0 ;
		return existing ;
	}
} ;

// Combine (subtree) before
treeOps.treeOperators['<*'] = {
	rank: rank ++ ,
	reduce: function( existing , operands ) {
		//if ( ! existing || typeof existing !== 'object' || Array.isArray( existing ) )
		if ( ! isPlainObject( existing ) ) {
			// Do nothing...
			return existing ;
		}

		// We have to reverse things before calling autoReduce()
		var rcpt = {} ;
		var args = [ existing ].concat( operands ).concat( rcpt ).reverse() ;

		//this.autoReduce.apply( this , args ) ;
		this.autoReduce( ... args ) ;
		operands.length = 0 ;

		return rcpt ;

		// Or:
		// this.assignObject( existing , rcpt ) ;
		// return existing ;
	}
} ;

// Combine (subtree) after
treeOps.treeOperators['*>'] = {
	rank: rank ++ ,
	reduce: function( existing , operands ) {
		//if ( ! existing || typeof existing !== 'object' || Array.isArray( existing ) )
		if ( ! isPlainObject( existing ) ) {
			// Do nothing...
			return existing ;
		}

		//console.log( "calling autoReduce with:" , require('string-kit').inspect( {style:'color',depth:10},[ existing ].concat( operands ) ) ) ;
		//this.autoReduce.apply( this , [ existing ].concat( operands ) ) ;
		this.autoReduce( existing , ... operands ) ;
		operands.length = 0 ;
		return existing ;
	}
} ;

// Combine (subtree) before, lower priority
treeOps.treeOperators['<<*'] = {
	rank: rank ++ ,
	reduce: treeOps.treeOperators['<*'].reduce
} ;

// Combine (subtree) after, lower priority
treeOps.treeOperators['*>>'] = {
	rank: rank ++ ,
	reduce: treeOps.treeOperators['*>'].reduce
} ;

// Concat before / prepend
treeOps.treeOperators['<+'] = {
	rank: rank ++ ,
	reduce: function( existing , operands ) {
		var i , iMax = operands.length , operand = [] ;

		for ( i = 0 ; i < iMax ; i ++ ) {
			if ( Array.isArray( operands[ i ] ) ) {
				operand = operands[ i ].concat( operand ) ;
			}
		}

		if ( Array.isArray( existing ) ) {
			existing = operand.concat( existing ) ;
			operands.length = 0 ;
			return existing ;
		}

		operands[ 0 ] = operand ;
		operands.length = 1 ;
		return existing ;

	}
} ;

// Concat after / append
treeOps.treeOperators['+>'] = {
	rank: rank ++ ,
	reduce: function( existing , operands ) {
		var i , iMax = operands.length , operand = [] ;

		for ( i = 0 ; i < iMax ; i ++ ) {
			if ( Array.isArray( operands[ i ] ) ) {
				operand = operand.concat( operands[ i ] ) ;
			}
		}

		if ( Array.isArray( existing ) ) {
			existing = existing.concat( operand ) ;
			operands.length = 0 ;
			return existing ;
		}

		operands[ 0 ] = operand ;
		operands.length = 1 ;
		return existing ;

	}
} ;

treeOps.treeOperators['/'] = {
	rank: rank ++ ,
	reduce: function( existing , operands ) {
		var i , iMax = operands.length , operand = 1 ;

		for ( i = 0 ; i < iMax ; i ++ ) {
			if ( ! isNaN( operands[ i ] ) ) {
				operand *= + operands[ i ] ;
			}
		}

		if ( ! isNaN( existing ) ) {
			existing = + existing / operand ;
			operands.length = 0 ;
			return existing ;
		}

		operands[ 0 ] = operand ;
		operands.length = 1 ;
		return existing ;

	}
} ;

treeOps.treeOperators['*'] = {
	rank: rank ++ ,
	reduce: function( existing , operands ) {
		var i , iMax = operands.length , operand = 1 ;

		for ( i = 0 ; i < iMax ; i ++ ) {
			if ( ! isNaN( operands[ i ] ) ) {
				operand *= + operands[ i ] ;
			}
		}

		if ( ! isNaN( existing ) ) {
			existing = + existing * operand ;
			operands.length = 0 ;
			return existing ;
		}

		operands[ 0 ] = operand ;
		operands.length = 1 ;
		return existing ;

	}
} ;

treeOps.treeOperators['-'] = {
	rank: rank ++ ,
	reduce: function( existing , operands ) {
		var i , iMax = operands.length , operand = 0 ;

		for ( i = 0 ; i < iMax ; i ++ ) {
			if ( ! isNaN( operands[ i ] ) ) {
				operand += + operands[ i ] ;
			}
		}

		if ( ! isNaN( existing ) ) {
			existing = + existing - operand ;
			operands.length = 0 ;
			return existing ;
		}

		operands[ 0 ] = operand ;
		operands.length = 1 ;
		return existing ;

	}
} ;

treeOps.treeOperators['+'] = {
	rank: rank ++ ,
	reduce: function( existing , operands ) {
		var i , iMax = operands.length , operand = 0 ;

		for ( i = 0 ; i < iMax ; i ++ ) {
			if ( ! isNaN( operands[ i ] ) ) {
				operand += + operands[ i ] ;
			}
		}

		if ( ! isNaN( existing ) ) {
			existing = + existing + operand ;
			operands.length = 0 ;
			return existing ;
		}

		operands[ 0 ] = operand ;
		operands.length = 1 ;
		return existing ;

	}
} ;



/*
The link mechanism is more complicated: it needs multipass at whole-tree level

treeOps.treeOperators['$'] = {
	rank: rank ++ ,
	multipass: true ,
	reduce: function( target , key , baseKey , root ) {

		var parts , source = root ;

		if ( target[ key ] ) { source = tree.path.get( root , target[ key ] ) ; }

		target[ baseKey ] = source ;
		delete target[ key ] ;

		// Multipass
		parts = this.splitOpKey( baseKey ) ;
		parts.rank = this.treeOperators[ parts.operator ].rank ;

		return parts ;
	}
} ;
*/



// Add operators to treeOps
treeOps.extendTreeOperators = function extendTreeOperators( operators ) {
	Object.assign( treeOps.treeOperators , operators ) ;
} ;



},{}],6:[function(require,module,exports){
/*
	Logfella Common Transport

	Copyright (c) 2015 - 2019 Cédric Ronvel

	The MIT License (MIT)

	Permission is hereby granted, free of charge, to any person obtaining a copy
	of this software and associated documentation files (the "Software"), to deal
	in the Software without restriction, including without limitation the rights
	to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
	copies of the Software, and to permit persons to whom the Software is
	furnished to do so, subject to the following conditions:

	The above copyright notice and this permission notice shall be included in all
	copies or substantial portions of the Software.

	THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
	IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
	FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
	AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
	LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
	OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
	SOFTWARE.
*/

"use strict" ;



// Empty constructor, it is just there to support instanceof operator
function CommonTransport( logger , config = {} ) {
	this.logger = null ;
	this.monitoring = false ;
	this.minLevel = 0 ;
	this.maxLevel = 7 ;
	this.messageFormatter = logger.messageFormatter.text ;
	this.timeFormatter = logger.timeFormatter.dateTime ;

	Object.defineProperty( this , 'logger' , { value: logger } ) ;

	if ( config.monitoring !== undefined ) { this.monitoring = !! config.monitoring ; }

	if ( config.minLevel !== undefined ) {
		if ( typeof config.minLevel === 'number' ) { this.minLevel = config.minLevel ; }
		else if ( typeof config.minLevel === 'string' ) { this.minLevel = this.logger.levelHash[ config.minLevel ] ; }
	}

	if ( config.maxLevel !== undefined ) {
		if ( typeof config.maxLevel === 'number' ) { this.maxLevel = config.maxLevel ; }
		else if ( typeof config.maxLevel === 'string' ) { this.maxLevel = this.logger.levelHash[ config.maxLevel ] ; }
	}

	if ( config.messageFormatter ) {
		if ( typeof config.messageFormatter === 'function' ) { this.messageFormatter = config.messageFormatter ; }
		else { this.messageFormatter = this.logger.messageFormatter[ config.messageFormatter ] ; }
	}

	if ( config.timeFormatter ) {
		if ( typeof config.timeFormatter === 'function' ) { this.timeFormatter = config.timeFormatter ; }
		else { this.timeFormatter = this.logger.timeFormatter[ config.timeFormatter ] ; }
	}
}

module.exports = CommonTransport ;



CommonTransport.prototype.transport = function transport( data , cache ) {} ;
CommonTransport.prototype.shutdown = function shutdown() {} ;


},{}],7:[function(require,module,exports){
(function (process,global){
(function (global, undefined) {
    "use strict";

    if (global.setImmediate) {
        return;
    }

    var nextHandle = 1; // Spec says greater than zero
    var tasksByHandle = {};
    var currentlyRunningATask = false;
    var doc = global.document;
    var registerImmediate;

    function setImmediate(callback) {
      // Callback can either be a function or a string
      if (typeof callback !== "function") {
        callback = new Function("" + callback);
      }
      // Copy function arguments
      var args = new Array(arguments.length - 1);
      for (var i = 0; i < args.length; i++) {
          args[i] = arguments[i + 1];
      }
      // Store and register the task
      var task = { callback: callback, args: args };
      tasksByHandle[nextHandle] = task;
      registerImmediate(nextHandle);
      return nextHandle++;
    }

    function clearImmediate(handle) {
        delete tasksByHandle[handle];
    }

    function run(task) {
        var callback = task.callback;
        var args = task.args;
        switch (args.length) {
        case 0:
            callback();
            break;
        case 1:
            callback(args[0]);
            break;
        case 2:
            callback(args[0], args[1]);
            break;
        case 3:
            callback(args[0], args[1], args[2]);
            break;
        default:
            callback.apply(undefined, args);
            break;
        }
    }

    function runIfPresent(handle) {
        // From the spec: "Wait until any invocations of this algorithm started before this one have completed."
        // So if we're currently running a task, we'll need to delay this invocation.
        if (currentlyRunningATask) {
            // Delay by doing a setTimeout. setImmediate was tried instead, but in Firefox 7 it generated a
            // "too much recursion" error.
            setTimeout(runIfPresent, 0, handle);
        } else {
            var task = tasksByHandle[handle];
            if (task) {
                currentlyRunningATask = true;
                try {
                    run(task);
                } finally {
                    clearImmediate(handle);
                    currentlyRunningATask = false;
                }
            }
        }
    }

    function installNextTickImplementation() {
        registerImmediate = function(handle) {
            process.nextTick(function () { runIfPresent(handle); });
        };
    }

    function canUsePostMessage() {
        // The test against `importScripts` prevents this implementation from being installed inside a web worker,
        // where `global.postMessage` means something completely different and can't be used for this purpose.
        if (global.postMessage && !global.importScripts) {
            var postMessageIsAsynchronous = true;
            var oldOnMessage = global.onmessage;
            global.onmessage = function() {
                postMessageIsAsynchronous = false;
            };
            global.postMessage("", "*");
            global.onmessage = oldOnMessage;
            return postMessageIsAsynchronous;
        }
    }

    function installPostMessageImplementation() {
        // Installs an event handler on `global` for the `message` event: see
        // * https://developer.mozilla.org/en/DOM/window.postMessage
        // * http://www.whatwg.org/specs/web-apps/current-work/multipage/comms.html#crossDocumentMessages

        var messagePrefix = "setImmediate$" + Math.random() + "$";
        var onGlobalMessage = function(event) {
            if (event.source === global &&
                typeof event.data === "string" &&
                event.data.indexOf(messagePrefix) === 0) {
                runIfPresent(+event.data.slice(messagePrefix.length));
            }
        };

        if (global.addEventListener) {
            global.addEventListener("message", onGlobalMessage, false);
        } else {
            global.attachEvent("onmessage", onGlobalMessage);
        }

        registerImmediate = function(handle) {
            global.postMessage(messagePrefix + handle, "*");
        };
    }

    function installMessageChannelImplementation() {
        var channel = new MessageChannel();
        channel.port1.onmessage = function(event) {
            var handle = event.data;
            runIfPresent(handle);
        };

        registerImmediate = function(handle) {
            channel.port2.postMessage(handle);
        };
    }

    function installReadyStateChangeImplementation() {
        var html = doc.documentElement;
        registerImmediate = function(handle) {
            // Create a <script> element; its readystatechange event will be fired asynchronously once it is inserted
            // into the document. Do so, thus queuing up the task. Remember to clean up once it's been called.
            var script = doc.createElement("script");
            script.onreadystatechange = function () {
                runIfPresent(handle);
                script.onreadystatechange = null;
                html.removeChild(script);
                script = null;
            };
            html.appendChild(script);
        };
    }

    function installSetTimeoutImplementation() {
        registerImmediate = function(handle) {
            setTimeout(runIfPresent, 0, handle);
        };
    }

    // If supported, we should attach to the prototype of global, since that is where setTimeout et al. live.
    var attachTo = Object.getPrototypeOf && Object.getPrototypeOf(global);
    attachTo = attachTo && attachTo.setTimeout ? attachTo : global;

    // Don't get fooled by e.g. browserify environments.
    if ({}.toString.call(global.process) === "[object process]") {
        // For Node.js before 0.9
        installNextTickImplementation();

    } else if (canUsePostMessage()) {
        // For non-IE10 modern browsers
        installPostMessageImplementation();

    } else if (global.MessageChannel) {
        // For web workers, where supported
        installMessageChannelImplementation();

    } else if (doc && "onreadystatechange" in doc.createElement("script")) {
        // For IE 6–8
        installReadyStateChangeImplementation();

    } else {
        // For older browsers
        installSetTimeoutImplementation();
    }

    attachTo.setImmediate = setImmediate;
    attachTo.clearImmediate = clearImmediate;
}(typeof self === "undefined" ? typeof global === "undefined" ? this : global : self));

}).call(this,require('_process'),typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})
},{"_process":46}],8:[function(require,module,exports){
/*
	Seventh

	Copyright (c) 2017 - 2019 Cédric Ronvel

	The MIT License (MIT)

	Permission is hereby granted, free of charge, to any person obtaining a copy
	of this software and associated documentation files (the "Software"), to deal
	in the Software without restriction, including without limitation the rights
	to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
	copies of the Software, and to permit persons to whom the Software is
	furnished to do so, subject to the following conditions:

	The above copyright notice and this permission notice shall be included in all
	copies or substantial portions of the Software.

	THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
	IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
	FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
	AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
	LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
	OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
	SOFTWARE.
*/

"use strict" ;



var Promise = require( './seventh.js' ) ;



Promise.promisifyNodeApi = ( api , suffix , multiSuffix , filter , anything ) => {
	var keys ;

	suffix = suffix || 'Async' ;
	multiSuffix = multiSuffix || 'AsyncAll' ;
	filter = filter || ( key => key[ 0 ] !== '_' && ! key.endsWith( 'Sync' ) ) ;

	if ( anything ) {
		keys = [] ;

		for ( let key in api ) {
			if ( typeof api[ key ] === 'function' ) { keys.push( key ) ; }
		}
	}
	else {
		keys = Object.keys( api ) ;
	}

	keys.filter( key => {
		if ( typeof api[ key ] !== 'function' ) { return false ; }

		// If it has any enumerable properties on its prototype, it's a constructor
		for ( let trash in api[ key ].prototype ) { return false ; }

		return filter( key , api ) ;
	} )
		.forEach( key => {
			const targetKey = key + suffix ;
			const multiTargetKey = key + multiSuffix ;

			// Do nothing if it already exists
			if ( ! api[ targetKey ] ) {
				api[ targetKey ] = Promise.promisify( api[ key ] , api ) ;
			}

			if ( ! api[ multiTargetKey ] ) {
				api[ multiTargetKey ] = Promise.promisifyAll( api[ key ] , api ) ;
			}
		} ) ;
} ;



Promise.promisifyAnyNodeApi = ( api , suffix , multiSuffix , filter ) => {
	Promise.promisifyNodeApi( api , suffix , multiSuffix , filter , true ) ;
} ;



},{"./seventh.js":14}],9:[function(require,module,exports){
/*
	Seventh

	Copyright (c) 2017 - 2019 Cédric Ronvel

	The MIT License (MIT)

	Permission is hereby granted, free of charge, to any person obtaining a copy
	of this software and associated documentation files (the "Software"), to deal
	in the Software without restriction, including without limitation the rights
	to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
	copies of the Software, and to permit persons to whom the Software is
	furnished to do so, subject to the following conditions:

	The above copyright notice and this permission notice shall be included in all
	copies or substantial portions of the Software.

	THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
	IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
	FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
	AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
	LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
	OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
	SOFTWARE.
*/

"use strict" ;



var Promise = require( './seventh.js' ) ;



// This object is used as a special unique value for array hole (see Promise.filter())
const HOLE = {} ;

function noop() {}



Promise.all = ( iterable ) => {
	var index = -1 , settled = false ,
		count = 0 , length = Infinity ,
		value , values = [] ,
		allPromise = new Promise() ;

	for ( value of iterable ) {
		if ( settled ) { break ; }

		index ++ ;

		// Create a scope to keep track of the promise's own index
		( () => {
			const promiseIndex = index ;

			Promise.resolve( value )
				.then(
					value_ => {
						if ( settled ) { return ; }

						values[ promiseIndex ] = value_ ;
						count ++ ;

						if ( count >= length ) {
							settled = true ;
							allPromise._resolveValue( values ) ;
						}
					} ,
					error => {
						if ( settled ) { return ; }
						settled = true ;
						allPromise.reject( error ) ;
					}
				) ;
		} )() ;
	}

	length = index + 1 ;

	if ( ! length ) {
		allPromise._resolveValue( values ) ;
	}

	return allPromise ;
} ;



// Maybe faster, but can't find any reasonable grounds for that ATM
//Promise.all =
Promise._allArray = ( iterable ) => {
	var length = iterable.length ;

	if ( ! length ) { Promise._resolveValue( [] ) ; }

	var index ,
		runtime = {
			settled: false ,
			count: 0 ,
			length: length ,
			values: [] ,
			allPromise: new Promise()
		} ;

	for ( index = 0 ; ! runtime.settled && index < length ; index ++ ) {
		Promise._allArrayOne( iterable[ index ] , index , runtime ) ;
	}

	return runtime.allPromise ;
} ;



// internal for allArray
Promise._allArrayOne = ( value , index , runtime ) => {
	Promise._bareThen( value ,
		value_ => {
			if ( runtime.settled ) { return ; }

			runtime.values[ index ] = value_ ;
			runtime.count ++ ;

			if ( runtime.count >= runtime.length ) {
				runtime.settled = true ;
				runtime.allPromise._resolveValue( runtime.values ) ;
			}
		} ,
		error => {
			if ( runtime.settled ) { return ; }
			runtime.settled = true ;
			runtime.allPromise.reject( error ) ;
		}
	) ;
} ;


// Promise.all() with an iterator
Promise.every =
Promise.map = ( iterable , iterator ) => {
	var index = -1 , settled = false ,
		count = 0 , length = Infinity ,
		value , values = [] ,
		allPromise = new Promise() ;

	for ( value of iterable ) {
		if ( settled ) { break ; }

		index ++ ;

		// Create a scope to keep track of the promise's own index
		( () => {
			const promiseIndex = index ;

			Promise.resolve( value )
				.then( value_ => {
					if ( settled ) { return ; }
					return iterator( value_ , promiseIndex ) ;
				} )
				.then(
					value_ => {
						if ( settled ) { return ; }

						values[ promiseIndex ] = value_ ;
						count ++ ;

						if ( count >= length ) {
							settled = true ;
							allPromise._resolveValue( values ) ;
						}
					} ,
					error => {
						if ( settled ) { return ; }
						settled = true ;
						allPromise.reject( error ) ;
					}
				) ;
		} )() ;
	}

	length = index + 1 ;

	if ( ! length ) {
		allPromise._resolveValue( values ) ;
	}

	return allPromise ;
} ;



/*
	It works symmetrically with Promise.all(), the resolve and reject logic are switched.
	Therefore, it resolves to the first resolving promise OR reject if all promises are rejected
	with, as a reason, the array of all promise rejection reasons.
*/
Promise.any = ( iterable ) => {
	var index = -1 , settled = false ,
		count = 0 , length = Infinity ,
		value ,
		errors = [] ,
		anyPromise = new Promise() ;

	for ( value of iterable ) {
		if ( settled ) { break ; }

		index ++ ;

		// Create a scope to keep track of the promise's own index
		( () => {
			const promiseIndex = index ;

			Promise.resolve( value )
				.then(
					value_ => {
						if ( settled ) { return ; }

						settled = true ;
						anyPromise._resolveValue( value_ ) ;
					} ,
					error => {
						if ( settled ) { return ; }

						errors[ promiseIndex ] = error ;
						count ++ ;

						if ( count >= length ) {
							settled = true ;
							anyPromise.reject( errors ) ;
						}
					}
				) ;
		} )() ;
	}

	length = index + 1 ;

	if ( ! length ) {
		anyPromise.reject( new RangeError( 'Promise.any(): empty array' ) ) ;
	}

	return anyPromise ;
} ;



// Like Promise.any() but with an iterator
Promise.some = ( iterable , iterator ) => {
	var index = -1 , settled = false ,
		count = 0 , length = Infinity ,
		value ,
		errors = [] ,
		anyPromise = new Promise() ;

	for ( value of iterable ) {
		if ( settled ) { break ; }

		index ++ ;

		// Create a scope to keep track of the promise's own index
		( () => {
			const promiseIndex = index ;

			Promise.resolve( value )
				.then( value_ => {
					if ( settled ) { return ; }
					return iterator( value_ , promiseIndex ) ;
				} )
				.then(
					value_ => {
						if ( settled ) { return ; }

						settled = true ;
						anyPromise._resolveValue( value_ ) ;
					} ,
					error => {
						if ( settled ) { return ; }

						errors[ promiseIndex ] = error ;
						count ++ ;

						if ( count >= length ) {
							settled = true ;
							anyPromise.reject( errors ) ;
						}
					}
				) ;
		} )() ;
	}

	length = index + 1 ;

	if ( ! length ) {
		anyPromise.reject( new RangeError( 'Promise.any(): empty array' ) ) ;
	}

	return anyPromise ;
} ;



/*
	More closed to Array#filter().
	The iterator should return truthy if the array element should be kept,
	or falsy if the element should be filtered out.
	Any rejection reject the whole promise.
*/
Promise.filter = ( iterable , iterator ) => {
	var index = -1 , settled = false ,
		count = 0 , length = Infinity ,
		value , values = [] ,
		filterPromise = new Promise() ;

	for ( value of iterable ) {
		if ( settled ) { break ; }

		index ++ ;

		// Create a scope to keep track of the promise's own index
		( () => {
			const promiseIndex = index ;

			Promise.resolve( value )
				.then( value_ => {
					if ( settled ) { return ; }
					values[ promiseIndex ] = value_ ;
					return iterator( value_ , promiseIndex ) ;
				} )
				.then(
					iteratorValue => {
						if ( settled ) { return ; }

						count ++ ;

						if ( ! iteratorValue ) { values[ promiseIndex ] = HOLE ; }

						if ( count >= length ) {
							settled = true ;
							values = values.filter( e => e !== HOLE ) ;
							filterPromise._resolveValue( values ) ;
						}
					} ,
					error => {
						if ( settled ) { return ; }
						settled = true ;
						filterPromise.reject( error ) ;
					}
				) ;
		} )() ;
	}

	length = index + 1 ;

	if ( ! length ) {
		filterPromise._resolveValue( values ) ;
	}
	else if ( count >= length ) {
		settled = true ;
		values = values.filter( e => e !== HOLE ) ;
		filterPromise._resolveValue( values ) ;
	}

	return filterPromise ;
} ;



// forEach performs reduce as well, if a third argument is supplied
// Force a function statement because we are using arguments.length, so we can support accumulator equals to undefined
Promise.foreach =
Promise.forEach = function( iterable , iterator , accumulator ) {
	var index = -1 ,
		isReduce = arguments.length >= 3 ,
		it = iterable[Symbol.iterator]() ,
		forEachPromise = new Promise() ,
		lastPromise = Promise.resolve( accumulator ) ;

	// The array-like may contains promises that could be rejected before being handled
	if ( Promise.warnUnhandledRejection ) { Promise._handleAll( iterable ) ; }

	var nextElement = () => {
		lastPromise.then(
			accumulator_ => {
				let { value , done } = it.next() ;
				index ++ ;

				if ( done ) {
					forEachPromise.resolve( accumulator_ ) ;
				}
				else {
					lastPromise = Promise.resolve( value ).then(
						isReduce ?
							value_ => iterator( accumulator_ , value_ , index ) :
							value_ => iterator( value_ , index )
					) ;

					nextElement() ;
				}
			} ,
			error => {
				forEachPromise.reject( error ) ;

				// We have to eat all remaining promise errors
				for ( ;; ) {
					let { value , done } = it.next() ;
					if ( done ) { break ; }

					//if ( ( value instanceof Promise ) || ( value instanceof NativePromise ) )
					if ( Promise.isThenable( value ) ) {
						value.then( noop , noop ) ;
					}
				}
			}
		) ;
	} ;

	nextElement() ;

	return forEachPromise ;
} ;



Promise.reduce = ( iterable , iterator , accumulator ) => {
	// Force 3 arguments
	return Promise.forEach( iterable , iterator , accumulator ) ;
} ;



/*
	Same than map, but iterate over an object and produce an object.
	Think of it as a kind of Object#map() (which of course does not exist).
*/
Promise.mapObject = ( inputObject , iterator ) => {
	var settled = false ,
		count = 0 ,
		i , key , keys = Object.keys( inputObject ) ,
		length = keys.length ,
		value , outputObject = {} ,
		mapPromise = new Promise() ;

	for ( i = 0 ; ! settled && i < length ; i ++ ) {
		key = keys[ i ] ;
		value = inputObject[ key ] ;

		// Create a scope to keep track of the promise's own key
		( () => {
			const promiseKey = key ;

			Promise.resolve( value )
				.then( value_ => {
					if ( settled ) { return ; }
					return iterator( value_ , promiseKey ) ;
				} )
				.then(
					value_ => {
						if ( settled ) { return ; }

						outputObject[ promiseKey ] = value_ ;
						count ++ ;

						if ( count >= length ) {
							settled = true ;
							mapPromise._resolveValue( outputObject ) ;
						}
					} ,
					error => {
						if ( settled ) { return ; }
						settled = true ;
						mapPromise.reject( error ) ;
					}
				) ;
		} )() ;
	}

	if ( ! length ) {
		mapPromise._resolveValue( outputObject ) ;
	}

	return mapPromise ;
} ;



// Like map, but with a concurrency limit
Promise.concurrent = ( limit , iterable , iterator ) => {
	var index = -1 , settled = false ,
		running = 0 ,
		count = 0 , length = Infinity ,
		value , done = false ,
		values = [] ,
		it = iterable[Symbol.iterator]() ,
		concurrentPromise = new Promise() ;

	// The array-like may contains promises that could be rejected before being handled
	if ( Promise.warnUnhandledRejection ) { Promise._handleAll( iterable ) ; }

	limit = limit || 1 ;

	const runBatch = () => {
		while ( ! done && running < limit ) {

			//console.log( "Pre" , index ) ;
			( { value , done } = it.next() ) ;

			if ( done ) {
				length = index + 1 ;

				if ( count >= length ) {
					settled = true ;
					concurrentPromise._resolveValue( values ) ;
					return ;
				}
				break ;
			}

			if ( settled ) { break ; }

			index ++ ;

			// Create a scope to keep track of the promise's own index
			( () => {
				const promiseIndex = index ;

				running ++ ;
				//console.log( "Launch" , promiseIndex ) ;

				Promise.resolve( value )
					.then( value_ => {
						if ( settled ) { return ; }
						return iterator( value_ , promiseIndex ) ;
					} )
					.then(
						value_ => {
						//console.log( "Done" , promiseIndex , value_ ) ;
							if ( settled ) { return ; }

							values[ promiseIndex ] = value_ ;
							count ++ ;
							running -- ;

							//console.log( "count/length" , count , length ) ;
							if ( count >= length ) {
								settled = true ;
								concurrentPromise._resolveValue( values ) ;
								return ;
							}

							if ( running < limit ) {
								runBatch() ;
								return ;
							}
						} ,
						error => {
							if ( settled ) { return ; }
							settled = true ;
							concurrentPromise.reject( error ) ;
						}
					) ;
			} )() ;
		}
	} ;

	runBatch() ;

	if ( index < 0 ) {
		concurrentPromise._resolveValue( values ) ;
	}

	return concurrentPromise ;
} ;



/*
	Like native Promise.race(), it is hanging forever if the array is empty.
	It resolves or rejects to the first resolved/rejected promise.
*/
Promise.race = ( iterable ) => {
	var settled = false ,
		value ,
		racePromise = new Promise() ;

	for ( value of iterable ) {
		if ( settled ) { break ; }

		Promise.resolve( value )
			.then(
				value_ => {
					if ( settled ) { return ; }

					settled = true ;
					racePromise._resolveValue( value_ ) ;
				} ,
				error => {
					if ( settled ) { return ; }

					settled = true ;
					racePromise.reject( error ) ;
				}
			) ;
	}

	return racePromise ;
} ;


},{"./seventh.js":14}],10:[function(require,module,exports){
(function (process,global,setImmediate){
/*
	Seventh

	Copyright (c) 2017 - 2019 Cédric Ronvel

	The MIT License (MIT)

	Permission is hereby granted, free of charge, to any person obtaining a copy
	of this software and associated documentation files (the "Software"), to deal
	in the Software without restriction, including without limitation the rights
	to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
	copies of the Software, and to permit persons to whom the Software is
	furnished to do so, subject to the following conditions:

	The above copyright notice and this permission notice shall be included in all
	copies or substantial portions of the Software.

	THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
	IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
	FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
	AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
	LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
	OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
	SOFTWARE.
*/

"use strict" ;



/*
	Prerequisite.
*/



const NativePromise = global.Promise ;

// Cross-platform next tick function
var nextTick ;

if ( ! process.browser ) {
	nextTick = process.nextTick ;
}
else {
	// Browsers suck, they don't have setImmediate() except IE/Edge.
	// A module is needed to emulate it.
	require( 'setimmediate' ) ;
	nextTick = setImmediate ;
}



/*
	Constructor.
*/



function Promise( fn ) {
	this.fn = fn ;
	this._then = Promise._dormantThen ;
	this.value = null ;
	this.thenHandlers = null ;
	this.handledRejection = null ;

	if ( this.fn ) {
		this._exec() ;
	}
}

module.exports = Promise ;



Promise.Native = NativePromise ;
Promise.warnUnhandledRejection = true ;



Promise.prototype._exec = function() {
	this._then = Promise._pendingThen ;

	try {
		this.fn(
			// Don't return anything, it would create nasty bugs! E.g.:
			// bad: error => this.reject( error_ )
			// good: error_ => { this.reject( error_ ) ; }
			result_ => { this.resolve( result_ ) ; } ,
			error_ => { this.reject( error_ ) ; }
		) ;
	}
	catch ( error ) {
		this.reject( error ) ;
	}
} ;



/*
	Resolve/reject and then-handlers management.
*/



Promise.prototype.resolve = Promise.prototype.fulfill = function( value ) {
	// Throw an error?
	if ( this._then.settled ) { return this ; }

	if ( Promise.isThenable( value ) ) {
		this._execThenPromise( value ) ;
		return this ;
	}

	return this._resolveValue( value ) ;
} ;



Promise.prototype._resolveValue = function( value ) {
	this._then = Promise._fulfilledThen ;
	this.value = value ;
	if ( this.thenHandlers && this.thenHandlers.length ) { this._execFulfillHandlers() ; }

	return this ;
} ;



// Faster on node v8.x
Promise.prototype._execThenPromise = function( thenPromise ) {
	try {
		thenPromise.then(
			result_ => { this.resolve( result_ ) ; } ,
			error_ => { this.reject( error_ ) ; }
		) ;
	}
	catch ( error ) {
		this.reject( error ) ;
	}
} ;



Promise.prototype.reject = function( error ) {
	// Throw an error?
	if ( this._then.settled ) { return this ; }

	this._then = Promise._rejectedThen ;
	this.value = error ;

	if ( this.thenHandlers && this.thenHandlers.length ) {
		this._execRejectionHandlers() ;
	}
	else if ( Promise.warnUnhandledRejection && ! this.handledRejection ) {
		this._unhandledRejection() ;
	}

	return this ;
} ;



Promise.prototype._execFulfillHandlers = function() {
	var i ,
		length = this.thenHandlers.length ;

	// Do cache the length, if a handler is synchronously added, it will be called on next tick
	for ( i = 0 ; i < length ; i += 3 ) {
		if ( this.thenHandlers[ i + 1 ] ) {
			this._execOneFulfillHandler( this.thenHandlers[ i ] , this.thenHandlers[ i + 1 ] ) ;
		}
		else {
			this.thenHandlers[ i ].resolve( this.value ) ;
		}
	}
} ;



// Faster on node v8.x?
//*
Promise.prototype._execOneFulfillHandler = function( promise , onFulfill ) {
	try {
		promise.resolve( onFulfill( this.value ) ) ;
	}
	catch ( error_ ) {
		promise.reject( error_ ) ;
	}
} ;
//*/



Promise.prototype._execRejectionHandlers = function() {
	var i ,
		length = this.thenHandlers.length ;

	// Do cache the length, if a handler is synchronously added, it will be called on next tick
	for ( i = 0 ; i < length ; i += 3 ) {
		if ( this.thenHandlers[ i + 2 ] ) {
			this._execOneRejectHandler( this.thenHandlers[ i ] , this.thenHandlers[ i + 2 ] ) ;
		}
		else {
			this.thenHandlers[ i ].reject( this.value ) ;
		}
	}
} ;



// Faster on node v8.x?
//*
Promise.prototype._execOneRejectHandler = function( promise , onReject ) {
	try {
		promise.resolve( onReject( this.value ) ) ;
	}
	catch ( error_ ) {
		promise.reject( error_ ) ;
	}
} ;
//*/



Promise.prototype.resolveTimeout = Promise.prototype.fulfillTimeout = function( time , result ) {
	setTimeout( () => this.resolve( result ) , time ) ;
} ;



Promise.prototype.rejectTimeout = function( time , error ) {
	setTimeout( () => this.reject( error ) , time ) ;
} ;



/*
	.then() variants depending on the state
*/



// .then() variant when the promise is dormant
Promise._dormantThen = function( onFulfill , onReject ) {
	if ( this.fn ) {
		// If this is a dormant promise, wake it up now!
		this._exec() ;

		// Return now, some sync stuff can change the status
		return this._then( onFulfill , onReject ) ;
	}

	var promise = new Promise() ;

	if ( ! this.thenHandlers ) {
		this.thenHandlers = [ promise , onFulfill , onReject ] ;
	}
	else {
		//this.thenHandlers.push( onFulfill ) ;
		this.thenHandlers[ this.thenHandlers.length ] = promise ;
		this.thenHandlers[ this.thenHandlers.length ] = onFulfill ;
		this.thenHandlers[ this.thenHandlers.length ] = onReject ;
	}

	return promise ;
} ;

Promise._dormantThen.settled = false ;



// .then() variant when the promise is pending
Promise._pendingThen = function( onFulfill , onReject ) {
	var promise = new Promise() ;

	if ( ! this.thenHandlers ) {
		this.thenHandlers = [ promise , onFulfill , onReject ] ;
	}
	else {
		//this.thenHandlers.push( onFulfill ) ;
		this.thenHandlers[ this.thenHandlers.length ] = promise ;
		this.thenHandlers[ this.thenHandlers.length ] = onFulfill ;
		this.thenHandlers[ this.thenHandlers.length ] = onReject ;
	}

	return promise ;
} ;

Promise._pendingThen.settled = false ;



// .then() variant when the promise is fulfilled
Promise._fulfilledThen = function( onFulfill ) {
	if ( ! onFulfill ) { return this ; }

	var promise = new Promise() ;

	// This handler should not fire in this code sync flow
	nextTick( () => {
		try {
			promise.resolve( onFulfill( this.value ) ) ;
		}
		catch ( error ) {
			promise.reject( error ) ;
		}
	} ) ;

	return promise ;
} ;

Promise._fulfilledThen.settled = true ;



// .then() variant when the promise is rejected
Promise._rejectedThen = function( onFulfill , onReject ) {
	if ( ! onReject ) { return this ; }

	this.handledRejection = true ;
	var promise = new Promise() ;

	// This handler should not fire in this code sync flow
	nextTick( () => {
		try {
			promise.resolve( onReject( this.value ) ) ;
		}
		catch ( error ) {
			promise.reject( error ) ;
		}
	} ) ;

	return promise ;
} ;

Promise._rejectedThen.settled = true ;



/*
	.then() and short-hands.
*/



Promise.prototype.then = function( onFulfill , onReject ) {
	return this._then( onFulfill , onReject ) ;
} ;



Promise.prototype.catch = function( onReject = () => undefined ) {
	return this._then( undefined , onReject ) ;
} ;



Promise.prototype.tap = function( onFulfill ) {
	this._then( onFulfill , undefined ) ;
	return this ;
} ;



Promise.prototype.tapCatch = function( onReject ) {
	this._then( undefined , onReject ) ;
	return this ;
} ;



Promise.prototype.finally = function( onSettled ) {
	this._then( onSettled , onSettled ) ;
	// Return this or this._then() ?
	return this ;
} ;



// Any unhandled error throw ASAP
Promise.prototype.fatal = function() {
	this._then( undefined , error => {
		// Throw async, otherwise it would be catched by .then()
		nextTick( () => { throw error ; } ) ;
	} ) ;
} ;



Promise.prototype.done = function( onFulfill , onReject ) {
	this._then( onFulfill , onReject ).fatal() ;
	return this ;
} ;



Promise.prototype.callback = function( cb ) {
	this._then(
		value => { cb( undefined , value ) ; } ,
		error => { cb( error ) ; }
	).fatal() ;

	return this ;
} ;



Promise.prototype.callbackAll = function( cb ) {
	this._then(
		values => {
			if ( Array.isArray( values ) ) { cb( undefined , ... values ) ; }
			else { cb( undefined , values ) ; }
		} ,
		error => { cb( error ) ; }
	).fatal() ;

	return this ;
} ;



/*
	The reverse of .callback(), it call the function with a callback argument and return a promise that resolve or reject depending on that callback invocation.
	Usage:
		await Promise.callback( callback => myFunctionRelyingOnCallback( [arg1] , [arg2] , [...] , callback ) ;
*/
Promise.callback = function( fn ) {
	return new Promise( ( resolve , reject ) => {
		fn( ( error , arg ) => {
			if ( error ) { reject( error ) ; }
			else { resolve( arg ) ; }
		} ) ;
	} ) ;
} ;



Promise.callbackAll = function( fn ) {
	return new Promise( ( resolve , reject ) => {
		fn( ( error , ... args ) => {
			if ( error ) { reject( error ) ; }
			else { resolve( args ) ; }
		} ) ;
	} ) ;
} ;



Promise.prototype.toPromise = function( promise ) {
	this._then(
		value => { promise.resolve( value ) ; } ,
		error => { promise.reject( error ) ; }
	) ;

	return this ;
} ;





/*
	Static factories.
*/



Promise.resolve = Promise.fulfill = function( value ) {
	if ( Promise.isThenable( value ) ) { return Promise.fromThenable( value ) ; }
	return Promise._resolveValue( value ) ;
} ;



Promise._resolveValue = function( value ) {
	var promise = new Promise() ;
	promise._then = Promise._fulfilledThen ;
	promise.value = value ;
	return promise ;
} ;



Promise.reject = function( error ) {
	//return new Promise().reject( error ) ;
	var promise = new Promise() ;
	promise._then = Promise._rejectedThen ;
	promise.value = error ;
	return promise ;
} ;



Promise.resolveTimeout = Promise.fulfillTimeout = function( timeout , value ) {
	return new Promise( resolve => setTimeout( () => resolve( value ) , timeout ) ) ;
} ;



Promise.rejectTimeout = function( timeout , error ) {
	return new Promise( ( resolve , reject ) => setTimeout( () => reject( error ) , timeout ) ) ;
} ;



// A dormant promise is activated the first time a then handler is assigned
Promise.dormant = function( fn ) {
	var promise = new Promise() ;
	promise.fn = fn ;
	return promise ;
} ;



// Try-catched Promise.resolve( fn() )
Promise.try = function( fn ) {
	try {
		return Promise.resolve( fn() ) ;
	}
	catch ( error ) {
		return Promise.reject( error ) ;
	}
} ;



/*
	Thenables.
*/



Promise.isThenable = function( value ) {
	return value && typeof value === 'object' && typeof value.then === 'function' ;
} ;



// We assume a thenable object here
Promise.fromThenable = function( thenable ) {
	if ( thenable instanceof Promise ) { return thenable ; }

	return new Promise( ( resolve , reject ) => {
		thenable.then(
			value => { resolve( value ) ; } ,
			error => { reject( error ) ; }
		) ;
	} ) ;
} ;



// When you just want a fast then() function out of anything, without any desync and unchainable
Promise._bareThen = function( value , onFulfill , onReject ) {
	//if ( Promise.isThenable( value ) )
	if( value && typeof value === 'object' ) {
		if ( value instanceof Promise ) {
			if ( value._then === Promise._fulfilledThen ) { onFulfill( value.value ) ; }
			else if ( value._then === Promise._rejectedThen ) { onReject( value.value ) ; }
			else { value._then( onFulfill , onReject ) ; }
		}
		else if ( typeof value.then === 'function' ) {
			value.then( onFulfill , onReject ) ;
		}
		else {
			onFulfill( value ) ;
		}
	}
	else {
		onFulfill( value ) ;
	}
} ;



/*
	Misc.
*/



// Internal usage, mark all promises as handled ahead of time, useful for series,
// because a warning would be displayed for unhandled rejection for promises that are not yet processed.
Promise._handleAll = function( iterable ) {
	var value ;

	for ( value of iterable ) {
		//if ( ( value instanceof Promise ) || ( value instanceof NativePromise ) )
		if ( Promise.isThenable( value ) ) {
			value.handledRejection = true ;
		}
	}
} ;



Promise.prototype._unhandledRejection = function() {
	// This promise is currently unhandled
	// If still unhandled at the end of the synchronous block of code,
	// output an error message.

	this.handledRejection = false ;

	// Don't know what is the correct way to inform node.js about that.
	// There is no doc about that, and emitting unhandledRejection,
	// does not produce what is expected.

	//process.emit( 'unhandledRejection' , this.value , this ) ;

	/*
	nextTick( () => {
		if ( this.handledRejection === false )
		{
			process.emit( 'unhandledRejection' , this.value , this ) ;
		}
	} ) ;
	*/

	// It looks like 'await' inside a 'try-catch' does not handle the promise soon enough -_-'
	//const nextTick_ = nextTick ;
	const nextTick_ = cb => setTimeout( cb , 0 ) ;

	//*
	if ( this.value instanceof Error ) {
		nextTick_( () => {
			if ( this.handledRejection === false ) {
				this.value.message = 'Unhandled promise rejection: ' + this.value.message ;
				console.error( this.value ) ;
			}
		} ) ;
	}
	else {
		// Avoid starting the stack trace in the nextTick()...
		let error_ = new Error( 'Unhandled promise rejection' ) ;
		nextTick_( () => {
			if ( this.handledRejection === false ) {
				console.error( error_ ) ;
				console.error( 'Rejection reason:' , this.value ) ;
			}
		} ) ;
	}
	//*/
} ;



Promise.prototype.getStatus = function() {
	switch ( this._then ) {
		case Promise._dormantThen :
			return 'dormant' ;
		case Promise._pendingThen :
			return 'pending' ;
		case Promise._fulfilledThen :
			return 'fulfilled' ;
		case Promise._rejectedThen :
			return 'rejected' ;
	}
} ;



Promise.prototype.inspect = function() {
	switch ( this._then ) {
		case Promise._dormantThen :
			return 'Promise { <DORMANT> }' ;
		case Promise._pendingThen :
			return 'Promise { <PENDING> }' ;
		case Promise._fulfilledThen :
			return 'Promise { <FULFILLED> ' + this.value + ' }' ;
		case Promise._rejectedThen :
			return 'Promise { <REJECTED> ' + this.value + ' }' ;
	}
} ;



// A shared dummy promise, when you just want to return an immediately thenable
Promise.resolved = Promise.dummy = Promise.resolve() ;


}).call(this,require('_process'),typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {},require("timers").setImmediate)
},{"_process":46,"setimmediate":7,"timers":47}],11:[function(require,module,exports){
/*
	Seventh

	Copyright (c) 2017 - 2019 Cédric Ronvel

	The MIT License (MIT)

	Permission is hereby granted, free of charge, to any person obtaining a copy
	of this software and associated documentation files (the "Software"), to deal
	in the Software without restriction, including without limitation the rights
	to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
	copies of the Software, and to permit persons to whom the Software is
	furnished to do so, subject to the following conditions:

	The above copyright notice and this permission notice shall be included in all
	copies or substantial portions of the Software.

	THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
	IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
	FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
	AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
	LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
	OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
	SOFTWARE.
*/

"use strict" ;



var Promise = require( './seventh.js' ) ;



Promise.promisifyAll = ( nodeAsyncFn , thisBinding ) => {
	if ( thisBinding === undefined ) {
		return function( ... args ) {
			return new Promise( ( resolve , reject ) => {
				nodeAsyncFn.call( this , ... args , ( error , ... cbArgs ) => {
					return error ? reject( error ) : resolve( cbArgs ) ;
				} ) ;
			} ) ;
		} ;
	}

	return ( ... args ) => {
		return new Promise( ( resolve , reject ) => {
			nodeAsyncFn.call( thisBinding , ... args , ( error , ... cbArgs ) => {
				return error ? reject( error ) : resolve( cbArgs ) ;
			} ) ;
		} ) ;
	} ;

} ;



// Same than .promisifyAll() but only return the callback args #1 instead of an array of args from #1 to #n
Promise.promisify = ( nodeAsyncFn , thisBinding ) => {
	if ( thisBinding === undefined ) {
		return function( ... args ) {
			return new Promise( ( resolve , reject ) => {
				nodeAsyncFn.call( this , ... args , ( error , cbArg ) => {
					return error ? reject( error ) : resolve( cbArg ) ;
				} ) ;
			} ) ;
		} ;
	}

	return ( ... args ) => {
		return new Promise( ( resolve , reject ) => {
			nodeAsyncFn.call( thisBinding , ... args , ( error , cbArg ) => {
				return error ? reject( error ) : resolve( cbArg ) ;
			} ) ;
		} ) ;
	} ;

} ;



/*
	Pass a function that will be called every time the decoratee return something.
*/
Promise.returnValueInterceptor = ( interceptor , asyncFn , thisBinding ) => {
	if ( thisBinding === undefined ) {
		return function( ... args ) {
			var returnVal = asyncFn.call( this , ... args ) ;
			interceptor( returnVal ) ;
			return returnVal ;
		} ;
	}

	return ( ... args ) => {
		var returnVal = asyncFn.call( thisBinding , ... args ) ;
		interceptor( returnVal ) ;
		return returnVal ;
	} ;
} ;



/*
	Run only once, return always the same promise.
*/
Promise.once = ( asyncFn , thisBinding ) => {
	var triggered = false ;
	var result ;

	return ( ... args ) => {
		if ( ! triggered ) {
			triggered = true ;
			result = asyncFn.call( thisBinding , ... args ) ;
		}

		return result ;
	} ;
} ;



/*
	It does nothing if the decoratee is still in progress, but return the promise of the action in progress.
*/
Promise.debounce = ( asyncFn , thisBinding ) => {
	var inProgress = null ;

	const outWrapper = () => {
		inProgress = null ;
	} ;

	return ( ... args ) => {
		if ( inProgress ) { return inProgress ; }

		inProgress = asyncFn.call( thisBinding , ... args ) ;
		inProgress.then( outWrapper , outWrapper ) ;
		return inProgress ;
	} ;
} ;



/*
	It does nothing if the decoratee is still in progress.
	Instead, the decoratee is called when finished once and only once, if it was tried one or more time during its progress.
	In case of multiple calls, the arguments of the last call will be used.
	The use case is .update()/.refresh()/.redraw() functions.
*/
Promise.debounceUpdate = ( asyncFn , thisBinding ) => {
	var inProgress = null ;
	var nextUpdateWith = null ;
	var nextUpdatePromise = null ;

	const outWrapper = () => {
		var args , sharedPromise ;

		inProgress = null ;

		if ( nextUpdateWith ) {
			args = nextUpdateWith ;
			nextUpdateWith = null ;
			sharedPromise = nextUpdatePromise ;
			nextUpdatePromise = null ;

			// Call the asyncFn again
			inProgress = asyncFn.call( thisBinding , ... args ) ;

			// Forward the result to the pending promise
			inProgress.then( ( value ) => sharedPromise.resolve( value ) , ( error ) => sharedPromise.reject( error ) ) ;

			// BTW, trigger again the outWrapper
			inProgress.then( outWrapper , outWrapper ) ;

			return inProgress ;
		}
	} ;

	const inWrapper = ( ... args ) => {
		if ( inProgress ) {
			if ( ! nextUpdatePromise ) { nextUpdatePromise = new Promise() ; }
			nextUpdateWith = args ;
			return nextUpdatePromise ;
		}

		inProgress = asyncFn.call( thisBinding , ... args ) ;
		inProgress.then( outWrapper , outWrapper ) ;
		return inProgress ;
	} ;

	return inWrapper ;
} ;



/*
	The decoratee execution does not overlap, multiple calls are serialized.
*/
Promise.serialize = ( asyncFn , thisBinding ) => {
	var lastPromise = new Promise.resolve() ;

	return ( ... args ) => {
		var promise = new Promise() ;

		lastPromise.finally( () => {
			asyncFn.call( thisBinding , ... args )
				.then( ( value ) => promise.resolve( value ) , ( error ) => promise.reject( error ) ) ;
		} ) ;

		lastPromise = promise ;

		return promise ;
	} ;
} ;



Promise.timeout = ( timeout , asyncFn , thisBinding ) => {
	if ( thisBinding === undefined ) {
		return function( ... args ) {
			var promise = asyncFn.call( this , ... args ) ;
			// Careful: not my promise, so cannot retrieve its status
			setTimeout( () => promise.reject( new Error( 'Timeout' ) ) , timeout ) ;
			return promise ;
		} ;
	}

	return ( ... args ) => {
		var promise = asyncFn.call( thisBinding , ... args ) ;
		// Careful: not my promise, so cannot retrieve its status
		setTimeout( () => promise.reject( new Error( 'Timeout' ) ) , timeout ) ;
		return promise ;
	} ;

} ;



// Like .timeout(), but here the timeout value is not passed at creation, but as the first arg of each call
Promise.variableTimeout = ( asyncFn , thisBinding ) => {
	if ( thisBinding === undefined ) {
		return function( timeout , ... args ) {
			var promise = asyncFn.call( this , ... args ) ;
			// Careful: not my promise, so cannot retrieve its status
			setTimeout( () => promise.reject( new Error( 'Timeout' ) ) , timeout ) ;
			return promise ;
		} ;
	}

	return ( timeout , ... args ) => {
		var promise = asyncFn.call( thisBinding , ... args ) ;
		// Careful: not my promise, so cannot retrieve its status
		setTimeout( () => promise.reject( new Error( 'Timeout' ) ) , timeout ) ;
		return promise ;
	} ;

} ;



/*
Promise.retry = ( retryCount , retryTimeout , timeoutMultiplier , asyncFn , thisBinding ) => {

	return ( ... args ) => {

		var lastError ,
			count = retryCount ,
			timeout = retryTimeout ,
			globalPromise = new Promise() ;

		const callAgain = () => {
			if ( count -- < 0 ) {
				globalPromise.reject( lastError ) ;
				return ;
			}

			var promise = asyncFn.call( thisBinding , ... args ) ;

			promise.then(
				//( value ) => globalPromise.resolve( value ) ,
				( value ) => {
					globalPromise.resolve( value ) ;
				} ,
				( error ) => {
					lastError = error ;
					setTimeout( callAgain , timeout ) ;
					timeout *= timeoutMultiplier ;
				}
			) ;
		} ;

		callAgain() ;

		return globalPromise ;
	} ;
} ;



Promise.variableRetry = ( asyncFn , thisBinding ) => {

	return ( retryCount , retryTimeout , timeoutMultiplier , ... args ) => {

		var lastError ,
			count = retryCount ,
			timeout = retryTimeout ,
			globalPromise = new Promise() ;

		const callAgain = () => {
			if ( count -- < 0 ) {
				globalPromise.reject( lastError ) ;
				return ;
			}

			var promise = asyncFn.call( thisBinding , ... args ) ;

			promise.then(
				( value ) => globalPromise.resolve( value ) ,
				( error ) => {
					lastError = error ;
					setTimeout( callAgain , timeout ) ;
					timeout *= timeoutMultiplier ;
				}
			) ;
		} ;

		callAgain() ;

		return globalPromise ;
	} ;
} ;
*/


},{"./seventh.js":14}],12:[function(require,module,exports){
(function (process){
/*
	Seventh

	Copyright (c) 2017 - 2019 Cédric Ronvel

	The MIT License (MIT)

	Permission is hereby granted, free of charge, to any person obtaining a copy
	of this software and associated documentation files (the "Software"), to deal
	in the Software without restriction, including without limitation the rights
	to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
	copies of the Software, and to permit persons to whom the Software is
	furnished to do so, subject to the following conditions:

	The above copyright notice and this permission notice shall be included in all
	copies or substantial portions of the Software.

	THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
	IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
	FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
	AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
	LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
	OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
	SOFTWARE.
*/

"use strict" ;



var Promise = require( './seventh.js' ) ;



/*
	Asynchronously exit.

	Wait for all listeners of the 'asyncExit' event (on the 'process' object) to have called their callback.
	The listeners receive the exit code about to be produced and a completion callback.
*/

var exitInProgress = false ;

Promise.asyncExit = function( exitCode , timeout ) {
	// Already exiting? no need to call it twice!
	if ( exitInProgress ) { return ; }

	exitInProgress = true ;

	var listeners = process.listeners( 'asyncExit' ) ;

	if ( ! listeners.length ) { process.exit( exitCode ) ; return ; }

	if ( timeout === undefined ) { timeout = 1000 ; }

	const callListener = listener => {

		if ( listener.length < 3 ) {
			// This listener does not have a callback, it is interested in the event but does not need to perform critical stuff.
			// E.g. a server will not accept connection or data anymore, but doesn't need cleanup.
			listener( exitCode , timeout ) ;
			return Promise.dummy ;
		}

		// This listener have a callback, it probably has critical stuff to perform before exiting.
		// E.g. a server that needs to gracefully exit will not accept connection or data anymore,
		// but still want to deliver request in progress.
		return new Promise( resolve => {
			listener( exitCode , timeout , () => { resolve() ; } ) ;
		} ) ;

	} ;

	// We don't care about errors here... We are exiting!
	Promise.map( listeners , callListener )
		.finally( () => process.exit( exitCode ) ) ;

	// Quit anyway if it's too long
	setTimeout( () => process.exit( exitCode ) , timeout ) ;
} ;



// A timeout that ensure a task get the time to perform its action (when there are CPU-bound tasks)
Promise.resolveSafeTimeout = function( timeout , value ) {
	return new Promise( resolve => {
		setTimeout( () => {
			setTimeout( () => {
				setTimeout( () => {
					setTimeout( () => resolve( value ) , 0 ) ;
				} , timeout / 2 ) ;
			} , timeout / 2 ) ;
		} , 0 ) ;
	} ) ;
} ;


}).call(this,require('_process'))
},{"./seventh.js":14,"_process":46}],13:[function(require,module,exports){
/*
	Seventh

	Copyright (c) 2017 - 2019 Cédric Ronvel

	The MIT License (MIT)

	Permission is hereby granted, free of charge, to any person obtaining a copy
	of this software and associated documentation files (the "Software"), to deal
	in the Software without restriction, including without limitation the rights
	to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
	copies of the Software, and to permit persons to whom the Software is
	furnished to do so, subject to the following conditions:

	The above copyright notice and this permission notice shall be included in all
	copies or substantial portions of the Software.

	THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
	IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
	FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
	AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
	LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
	OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
	SOFTWARE.
*/

"use strict" ;



var Promise = require( './seventh.js' ) ;



/*
	This parasite the native promise, bringing some of seventh features into them.
*/

Promise.parasite = () => {

	var compatibleProtoFn = [
		'tap' , 'tapCatch' , 'finally' ,
		'fatal' , 'done' ,
		'callback' , 'callbackAll'
	] ;

	compatibleProtoFn.forEach( fn => Promise.Native.prototype[ fn ] = Promise.prototype[ fn ] ) ;
	Promise.Native.prototype._then = Promise.Native.prototype.then ;
} ;


},{"./seventh.js":14}],14:[function(require,module,exports){
/*
	Seventh

	Copyright (c) 2017 - 2019 Cédric Ronvel

	The MIT License (MIT)

	Permission is hereby granted, free of charge, to any person obtaining a copy
	of this software and associated documentation files (the "Software"), to deal
	in the Software without restriction, including without limitation the rights
	to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
	copies of the Software, and to permit persons to whom the Software is
	furnished to do so, subject to the following conditions:

	The above copyright notice and this permission notice shall be included in all
	copies or substantial portions of the Software.

	THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
	IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
	FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
	AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
	LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
	OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
	SOFTWARE.
*/

"use strict" ;



const seventh = require( './core.js' ) ;
module.exports = seventh ;

// The order matters
require( './batch.js' ) ;
require( './wrapper.js' ) ;
require( './decorators.js' ) ;
require( './api.js' ) ;
require( './parasite.js' ) ;
require( './misc.js' ) ;


},{"./api.js":8,"./batch.js":9,"./core.js":10,"./decorators.js":11,"./misc.js":12,"./parasite.js":13,"./wrapper.js":15}],15:[function(require,module,exports){
/*
	Seventh

	Copyright (c) 2017 - 2019 Cédric Ronvel

	The MIT License (MIT)

	Permission is hereby granted, free of charge, to any person obtaining a copy
	of this software and associated documentation files (the "Software"), to deal
	in the Software without restriction, including without limitation the rights
	to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
	copies of the Software, and to permit persons to whom the Software is
	furnished to do so, subject to the following conditions:

	The above copyright notice and this permission notice shall be included in all
	copies or substantial portions of the Software.

	THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
	IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
	FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
	AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
	LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
	OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
	SOFTWARE.
*/

"use strict" ;



var Promise = require( './seventh.js' ) ;



Promise.timeLimit = ( timeout , asyncFnOrPromise ) => {
	return new Promise( ( resolve , reject ) => {
		if ( typeof asyncFnOrPromise === 'function' ) { asyncFnOrPromise = asyncFnOrPromise() ; }
		Promise.resolve( asyncFnOrPromise ).then( resolve , reject ) ;
		setTimeout( () => reject( new Error( "Timeout" ) ) , timeout ) ;
	} ) ;
} ;



/*
	options:
		retries: number of retry
		coolDown: time before retrying
		raiseFactor: time multiplier for each successive cool down
		maxCoolDown: maximum cool-down, the raising time is capped to this value
		timeout: time before assuming it has failed, 0 = no time limit
		catch: `function` (optional) if absent, the function is always retried until it reaches the limit,
			if present, that catch-function is used like a normal promise catch block, the function is retry
			only if the catch-function does not throw or return a rejecting promise
*/
Promise.retry = ( options , asyncFn ) => {
	var count = options.retries || 1 ,
		coolDown = options.coolDown || 0 ,
		raiseFactor = options.raiseFactor || 1 ,
		maxCoolDown = options.maxCoolDown || Infinity ,
		timeout = options.timeout || 0 ,
		catchFn = options.catch || null ;

	const oneTry = () => {
		return ( timeout ? Promise.timeLimit( timeout , asyncFn ) : asyncFn() ).catch( error => {
			if ( ! count -- ) { throw error ; }

			var currentCoolDown = coolDown ;
			coolDown = Math.min( coolDown * raiseFactor , maxCoolDown ) ;

			if ( catchFn ) {
				// Call the custom catch function
				// Let it crash, if it throw we are already in a .catch() block
				return Promise.resolve( catchFn( error ) ).then( () => Promise.resolveTimeout( currentCoolDown ).then( oneTry ) ) ;
			}

			return Promise.resolveTimeout( currentCoolDown ).then( oneTry ) ;
		} ) ;
	} ;

	return oneTry() ;
} ;



// Resolve once an event is fired
Promise.onceEvent = ( emitter , eventName ) => {
	return new Promise( resolve => emitter.once( eventName , resolve ) ) ;
} ;



// Resolve once an event is fired, resolve with an array of arguments
Promise.onceEventAll = ( emitter , eventName ) => {
	return new Promise( resolve => emitter.once( eventName , ( ... args ) => resolve( args ) ) ) ;
} ;



// Resolve once an event is fired, or reject on error
Promise.onceEventOrError = ( emitter , eventName , excludeEvents ) => {
	return new Promise( ( resolve , reject ) => {
		var altRejects ;

		// We care about removing listener, especially 'error', because if an error kick in after, it should throw because there is no listener
		var resolve_ = arg => {
			emitter.removeListener( 'error' , reject_ ) ;

			if ( altRejects ) {
				for ( let event in altRejects ) {
					emitter.removeListener( event , altRejects[ event ] ) ;
				}
			}

			resolve( arg ) ;
		} ;

		var reject_ = arg => {
			emitter.removeListener( eventName , resolve_ ) ;

			if ( altRejects ) {
				for ( let event in altRejects ) {
					emitter.removeListener( event , altRejects[ event ] ) ;
				}
			}

			reject( arg ) ;
		} ;

		emitter.once( eventName , resolve_ ) ;
		emitter.once( 'error' , reject_ ) ;

		if ( excludeEvents ) {
			if ( ! Array.isArray( excludeEvents ) ) { excludeEvents = [ excludeEvents ] ; }

			altRejects = {} ;

			excludeEvents.forEach( event => {
				var altReject = ( ... args ) => {
					emitter.removeListener( 'error' , reject_ ) ;
					emitter.removeListener( eventName , resolve_ ) ;

					var error = new Error( "Received an excluded event: " + event ) ;
					error.event = event ;
					error.eventArgs = args ;
					reject( error ) ;
				} ;

				emitter.once( event , altReject ) ;

				altRejects[ event ] = altReject ;
			} ) ;
		}
	} ) ;
} ;



// Resolve once an event is fired, or reject on error, resolve with an array of arguments, reject with the first argument
Promise.onceEventAllOrError = ( emitter , eventName , excludeEvents ) => {
	return new Promise( ( resolve , reject ) => {
		var altRejects ;

		// We care about removing listener, especially 'error', because if an error kick in after, it should throw because there is no listener
		var resolve_ = ( ... args ) => {
			emitter.removeListener( 'error' , reject_ ) ;

			if ( altRejects ) {
				for ( let event in altRejects ) {
					emitter.removeListener( event , altRejects[ event ] ) ;
				}
			}

			resolve( args ) ;
		} ;

		var reject_ = arg => {
			emitter.removeListener( eventName , resolve_ ) ;

			if ( altRejects ) {
				for ( let event in altRejects ) {
					emitter.removeListener( event , altRejects[ event ] ) ;
				}
			}

			reject( arg ) ;
		} ;

		emitter.once( eventName , resolve_ ) ;
		emitter.once( 'error' , reject_ ) ;

		if ( excludeEvents ) {
			if ( ! Array.isArray( excludeEvents ) ) { excludeEvents = [ excludeEvents ] ; }

			altRejects = {} ;

			excludeEvents.forEach( event => {
				var altReject = ( ... args ) => {
					emitter.removeListener( 'error' , reject_ ) ;
					emitter.removeListener( eventName , resolve_ ) ;

					var error = new Error( "Received an excluded event: " + event ) ;
					error.event = event ;
					error.eventArgs = args ;
					reject( error ) ;
				} ;

				emitter.once( event , altReject ) ;

				altRejects[ event ] = altReject ;
			} ) ;
		}
	} ) ;
} ;


},{"./seventh.js":14}],16:[function(require,module,exports){
/*
	String Kit

	Copyright (c) 2014 - 2019 Cédric Ronvel

	The MIT License (MIT)

	Permission is hereby granted, free of charge, to any person obtaining a copy
	of this software and associated documentation files (the "Software"), to deal
	in the Software without restriction, including without limitation the rights
	to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
	copies of the Software, and to permit persons to whom the Software is
	furnished to do so, subject to the following conditions:

	The above copyright notice and this permission notice shall be included in all
	copies or substantial portions of the Software.

	THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
	IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
	FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
	AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
	LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
	OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
	SOFTWARE.
*/

"use strict" ;



// To solve dependency hell, we do not rely on terminal-kit anymore.
module.exports = {
	reset: '\x1b[0m' ,
	bold: '\x1b[1m' ,
	dim: '\x1b[2m' ,
	italic: '\x1b[3m' ,
	underline: '\x1b[4m' ,
	inverse: '\x1b[7m' ,

	defaultColor: '\x1b[39m' ,
	black: '\x1b[30m' ,
	red: '\x1b[31m' ,
	green: '\x1b[32m' ,
	yellow: '\x1b[33m' ,
	blue: '\x1b[34m' ,
	magenta: '\x1b[35m' ,
	cyan: '\x1b[36m' ,
	white: '\x1b[37m' ,
	grey: '\x1b[90m' ,
	gray: '\x1b[90m' ,
	brightBlack: '\x1b[90m' ,
	brightRed: '\x1b[91m' ,
	brightGreen: '\x1b[92m' ,
	brightYellow: '\x1b[93m' ,
	brightBlue: '\x1b[94m' ,
	brightMagenta: '\x1b[95m' ,
	brightCyan: '\x1b[96m' ,
	brightWhite: '\x1b[97m' ,

	defaultBgColor: '\x1b[49m' ,
	bgBlack: '\x1b[40m' ,
	bgRed: '\x1b[41m' ,
	bgGreen: '\x1b[42m' ,
	bgYellow: '\x1b[43m' ,
	bgBlue: '\x1b[44m' ,
	bgMagenta: '\x1b[45m' ,
	bgCyan: '\x1b[46m' ,
	bgWhite: '\x1b[47m' ,
	bgGrey: '\x1b[100m' ,
	bgGray: '\x1b[100m' ,
	bgBrightBlack: '\x1b[100m' ,
	bgBrightRed: '\x1b[101m' ,
	bgBrightGreen: '\x1b[102m' ,
	bgBrightYellow: '\x1b[103m' ,
	bgBrightBlue: '\x1b[104m' ,
	bgBrightMagenta: '\x1b[105m' ,
	bgBrightCyan: '\x1b[106m' ,
	bgBrightWhite: '\x1b[107m'
} ;


},{}],17:[function(require,module,exports){
/*
	String Kit

	Copyright (c) 2014 - 2019 Cédric Ronvel

	The MIT License (MIT)

	Permission is hereby granted, free of charge, to any person obtaining a copy
	of this software and associated documentation files (the "Software"), to deal
	in the Software without restriction, including without limitation the rights
	to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
	copies of the Software, and to permit persons to whom the Software is
	furnished to do so, subject to the following conditions:

	The above copyright notice and this permission notice shall be included in all
	copies or substantial portions of the Software.

	THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
	IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
	FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
	AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
	LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
	OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
	SOFTWARE.
*/

"use strict" ;



var camel = {} ;
module.exports = camel ;



// Transform alphanum separated by underscore or minus to camel case
camel.toCamelCase = function toCamelCase( str , preserveUpperCase = false ) {
	if ( ! str || typeof str !== 'string' ) { return '' ; }

	return str.replace( /^[\s_-]*([^\s_-]+)|[\s_-]+([^\s_-]?)([^\s_-]*)/g , ( match , firstWord , firstLetter , endOfWord ) => {

		if ( preserveUpperCase ) {
			if ( firstWord ) { return firstWord ; }
			if ( ! firstLetter ) { return '' ; }
			return firstLetter.toUpperCase() + endOfWord ;
		}

		if ( firstWord ) { return firstWord.toLowerCase() ; }
		if ( ! firstLetter ) { return '' ; }
		return firstLetter.toUpperCase() + endOfWord.toLowerCase() ;

	} ) ;
} ;



// Transform camel case to alphanum separated by minus
camel.camelCaseToDash =
camel.camelCaseToDashed = function camelCaseToDash( str ) {
	if ( ! str || typeof str !== 'string' ) { return '' ; }

	return str.replace( /^([A-Z])|([A-Z])/g , ( match , firstLetter , letter ) => {

		if ( firstLetter ) { return firstLetter.toLowerCase() ; }
		return '-' + letter.toLowerCase() ;
	} ) ;
} ;



},{}],18:[function(require,module,exports){
/*
	String Kit

	Copyright (c) 2014 - 2019 Cédric Ronvel

	The MIT License (MIT)

	Permission is hereby granted, free of charge, to any person obtaining a copy
	of this software and associated documentation files (the "Software"), to deal
	in the Software without restriction, including without limitation the rights
	to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
	copies of the Software, and to permit persons to whom the Software is
	furnished to do so, subject to the following conditions:

	The above copyright notice and this permission notice shall be included in all
	copies or substantial portions of the Software.

	THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
	IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
	FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
	AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
	LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
	OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
	SOFTWARE.
*/

/*
	Escape collection.
*/



"use strict" ;



// From Mozilla Developper Network
// https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/Regular_Expressions
exports.regExp = exports.regExpPattern = function escapeRegExpPattern( str ) {
	return str.replace( /([.*+?^${}()|[\]/\\])/g , '\\$1' ) ;
} ;

exports.regExpReplacement = function escapeRegExpReplacement( str ) {
	return str.replace( /\$/g , '$$$$' ) ;	// This replace any single $ by a double $$
} ;



exports.format = function escapeFormat( str ) {
	return str.replace( /%/g , '%%' ) ;	// This replace any single % by a double %%
} ;



exports.jsSingleQuote = function escapeJsSingleQuote( str ) {
	return exports.control( str ).replace( /'/g , "\\'" ) ;
} ;

exports.jsDoubleQuote = function escapeJsDoubleQuote( str ) {
	return exports.control( str ).replace( /"/g , '\\"' ) ;
} ;



exports.shellArg = function escapeShellArg( str ) {
	return '\'' + str.replace( /'/g , "'\\''" ) + '\'' ;
} ;



var escapeControlMap = {
	'\r': '\\r' ,
	'\n': '\\n' ,
	'\t': '\\t' ,
	'\x7f': '\\x7f'
} ;

// Escape \r \n \t so they become readable again, escape all ASCII control character as well, using \x syntaxe
exports.control = function escapeControl( str , keepNewLineAndTab = false ) {
	return str.replace( /[\x00-\x1f\x7f]/g , ( match ) => {
		if ( keepNewLineAndTab && ( match === '\n' || match === '\t' ) ) { return match ; }
		if ( escapeControlMap[ match ] !== undefined ) { return escapeControlMap[ match ] ; }
		var hex = match.charCodeAt( 0 ).toString( 16 ) ;
		if ( hex.length % 2 ) { hex = '0' + hex ; }
		return '\\x' + hex ;
	} ) ;
} ;



var escapeHtmlMap = {
	'&': '&amp;' ,
	'<': '&lt;' ,
	'>': '&gt;' ,
	'"': '&quot;' ,
	"'": '&#039;'
} ;

// Only escape & < > so this is suited for content outside tags
exports.html = function escapeHtml( str ) {
	return str.replace( /[&<>]/g , ( match ) => { return escapeHtmlMap[ match ] ; } ) ;
} ;

// Escape & < > " so this is suited for content inside a double-quoted attribute
exports.htmlAttr = function escapeHtmlAttr( str ) {
	return str.replace( /[&<>"]/g , ( match ) => { return escapeHtmlMap[ match ] ; } ) ;
} ;

// Escape all html special characters & < > " '
exports.htmlSpecialChars = function escapeHtmlSpecialChars( str ) {
	return str.replace( /[&<>"']/g , ( match ) => { return escapeHtmlMap[ match ] ; } ) ;
} ;


},{}],19:[function(require,module,exports){
(function (Buffer){
/*
	String Kit

	Copyright (c) 2014 - 2019 Cédric Ronvel

	The MIT License (MIT)

	Permission is hereby granted, free of charge, to any person obtaining a copy
	of this software and associated documentation files (the "Software"), to deal
	in the Software without restriction, including without limitation the rights
	to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
	copies of the Software, and to permit persons to whom the Software is
	furnished to do so, subject to the following conditions:

	The above copyright notice and this permission notice shall be included in all
	copies or substantial portions of the Software.

	THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
	IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
	FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
	AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
	LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
	OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
	SOFTWARE.
*/

/*
	String formater, inspired by C's sprintf().
*/



"use strict" ;



var inspect = require( './inspect.js' ).inspect ;
var inspectError = require( './inspect.js' ).inspectError ;
var escape = require( './escape.js' ) ;
var ansi = require( './ansi.js' ) ;



/*
	%%		a single %
	%s		string
	%S		string, interpret ^ formatting
	%r		raw string: without sanitizer
	%f		float
	%e		for scientific notation
	%d	%i	integer
	%u		unsigned integer
	%U		unsigned positive integer (>0)
	%k		metric system
	%t		time duration, convert ms into H:min:s
	%h		hexadecimal
	%x		hexadecimal, force pair of symbols (e.g. 'f' -> '0f')
	%o		octal
	%b		binary
	%z		base64
	%Z		base64url
	%I		call string-kit's inspect()
	%Y		call string-kit's inspect(), but do not inspect non-enumerable
	%E		call string-kit's inspectError()
	%J		JSON.stringify()
	%D		drop
	%F		filter function existing in the 'this' context, e.g. %[filter:%a%a]F
	%a		argument for a function

	Candidate format:
	%A		for automatic type?
	%c		for char? (can receive a string or an integer translated into an UTF8 chars)
	%C		for currency formating?
	%B		for Buffer objects?
*/

exports.formatMethod = function format( ... args ) {
	var str = args[ 0 ] ;

	if ( typeof str !== 'string' ) {
		if ( ! str ) { str = '' ; }
		else if ( typeof str.toString === 'function' ) { str = str.toString() ; }
		else { str = '' ; }
	}

	var arg , autoIndex = 1 , length = args.length ,
		hasMarkup = false , shift = null , markupStack = [] ;

	if ( this.markupReset && this.startingMarkupReset ) {
		str = ( typeof this.markupReset === 'function' ? this.markupReset( markupStack ) : this.markupReset ) + str ;
	}

	//console.log( 'format args:' , arguments ) ;

	// /!\ each changes here should be reported on string.format.count() and string.format.hasFormatting() too /!\
	//str = str.replace( /\^(.?)|%(?:([+-]?)([0-9]*)(?:\/([^\/]*)\/)?([a-zA-Z%])|\[([a-zA-Z0-9_]+)(?::([^\]]*))?\])/g ,
	str = str.replace( /\^(.?)|(%%)|%([+-]?)([0-9]*)(?:\[([^\]]*)\])?([a-zA-Z])/g ,
		( match , markup , doublePercent , relative , index , modeArg , mode ) => {

			var replacement , i , tmp , fn , fnArgString , argMatches , argList = [] ;

			//console.log( 'replaceArgs:' , arguments ) ;
			if ( doublePercent ) { return '%' ; }

			if ( markup ) {
				if ( this.noMarkup ) { return '^' + markup ; }
				if ( markup === '^' ) { return '^' ; }

				if ( this.shiftMarkup && this.shiftMarkup[ markup ] ) {
					shift = this.shiftMarkup[ markup ] ;
					return '' ;
				}

				if ( shift ) {
					if ( ! this.shiftedMarkup || ! this.shiftedMarkup[ shift ] || ! this.shiftedMarkup[ shift ][ markup ] ) {
						return '' ;
					}

					hasMarkup = true ;

					if ( typeof this.shiftedMarkup[ shift ][ markup ] === 'function' ) {
						replacement = this.shiftedMarkup[ shift ][ markup ]( markupStack ) ;
						// method should manage markup stack themselves
					}
					else {
						replacement = this.shiftedMarkup[ shift ][ markup ] ;
						markupStack.push( replacement ) ;
					}

					shift = null ;
				}
				else {
					if ( ! this.markup || ! this.markup[ markup ] ) {
						return '' ;
					}

					hasMarkup = true ;

					if ( typeof this.markup[ markup ] === 'function' ) {
						replacement = this.markup[ markup ]( markupStack ) ;
						// method should manage markup stack themselves
					}
					else {
						replacement = this.markup[ markup ] ;
						markupStack.push( replacement ) ;
					}
				}

				return replacement ;
			}


			if ( index ) {
				index = parseInt( index , 10 ) ;

				if ( relative ) {
					if ( relative === '+' ) { index = autoIndex + index ; }
					else if ( relative === '-' ) { index = autoIndex - index ; }
				}
			}
			else {
				index = autoIndex ;
			}

			autoIndex ++ ;

			if ( index >= length || index < 1 ) { arg = undefined ; }
			else { arg = args[ index ] ; }

			if ( modes[ mode ] ) {
				replacement = modes[ mode ]( arg , modeArg , this ) ;
				if ( this.argumentSanitizer && ! modes[ mode ].noSanitize ) { replacement = this.argumentSanitizer( replacement ) ; }
				return replacement ;
			}

			// Function mode
			if ( mode === 'F' ) {
				autoIndex -- ;	// %F does not eat any arg

				if ( modeArg === undefined ) { return '' ; }
				tmp = modeArg.split( ':' ) ;
				fn = tmp[ 0 ] ;
				fnArgString = tmp[ 1 ] ;
				if ( ! fn ) { return '' ; }

				if ( fnArgString && ( argMatches = fnArgString.match( /%([+-]?)([0-9]*)[a-zA-Z]/g ) ) ) {
					//console.log( argMatches ) ;
					//console.log( fnArgString ) ;
					for ( i = 0 ; i < argMatches.length ; i ++ ) {
						relative = argMatches[ i ][ 1 ] ;
						index = argMatches[ i ][ 2 ] ;

						if ( index ) {
							index = parseInt( index , 10 ) ;

							if ( relative ) {
								if ( relative === '+' ) { index = autoIndex + index ; }		// jshint ignore:line
								else if ( relative === '-' ) { index = autoIndex - index ; }	// jshint ignore:line
							}
						}
						else {
							index = autoIndex ;
						}

						autoIndex ++ ;

						if ( index >= length || index < 1 ) { argList[ i ] = undefined ; }
						else { argList[ i ] = args[ index ] ; }
					}
				}

				if ( ! this || ! this.fn || typeof this.fn[ fn ] !== 'function' ) { return '' ; }
				return this.fn[ fn ].apply( this , argList ) ;
			}

			return '' ;
		}
	) ;

	if ( hasMarkup && this.markupReset && this.endingMarkupReset ) {
		str += typeof this.markupReset === 'function' ? this.markupReset( markupStack ) : this.markupReset ;
	}

	if ( this.extraArguments ) {
		for ( ; autoIndex < length ; autoIndex ++ ) {
			arg = args[ autoIndex ] ;
			if ( arg === null || arg === undefined ) { continue ; }
			else if ( typeof arg === 'string' ) { str += arg ; }
			else if ( typeof arg === 'number' ) { str += arg ; }
			else if ( typeof arg.toString === 'function' ) { str += arg.toString() ; }
		}
	}

	return str ;
} ;


var modes = {} ;



// string
modes.s = arg => {
	if ( typeof arg === 'string' ) { return arg ; }
	if ( arg === null || arg === undefined || arg === true || arg === false ) { return '(' + arg + ')' ; }
	if ( typeof arg === 'number' ) { return '' + arg ; }
	if ( typeof arg.toString === 'function' ) { return arg.toString() ; }
	return '(' + arg + ')' ;
} ;

modes.r = arg => modes.s( arg ) ;
modes.r.noSanitize = true ;



// string, interpret ^ formatting
modes.S = ( arg , modeArg , options ) => {
	// We do the sanitizing part on our own
	var interpret = str => exports.markupMethod.call( options , options.argumentSanitizer ? options.argumentSanitizer( str ) : str ) ;

	if ( typeof arg === 'string' ) { return interpret( arg ) ; }
	if ( arg === null || arg === undefined || arg === true || arg === false ) { return '(' + arg + ')' ; }
	if ( typeof arg === 'number' ) { return '' + arg ; }
	if ( typeof arg.toString === 'function' ) { return interpret( arg.toString() ) ; }
	return interpret( '(' + arg + ')' ) ;
} ;

modes.S.noSanitize = true ;



const NUMBER_FORMAT_REGEX = /([a-zA-Z]?)(.[^a-zA-Z]*)/g ;



// float
modes.f = ( arg , modeArg ) => {
	var match , k , v , lv , n ,
		step = 0 , toFixed , toFixedIfDecimal , padding ;

	if ( typeof arg === 'string' ) { arg = parseFloat( arg ) ; }
	if ( typeof arg !== 'number' ) { arg = 0 ; }

	if ( modeArg ) {
		NUMBER_FORMAT_REGEX.index = 0 ;

		while ( ( match = NUMBER_FORMAT_REGEX.exec( modeArg ) ) ) {
			[ , k , v ] = match ;

			if ( k === 'p' ) {
				padding = + v ;
			}
			else if ( v[ 0 ] === '.' ) {
				lv = v[ v.length - 1 ] ;

				if ( lv === '!' ) {
					n = parseInt( v.slice( 1 , -1 ) , 10 ) ;
					step = 10 ** ( -n ) ;
					toFixed = n ;
				}
				else if ( lv === '?' ) {
					n = parseInt( v.slice( 1 , -1 ) , 10 ) ;
					step = 10 ** ( -n ) ;
					toFixed = n ;
					toFixedIfDecimal = true ;
				}
				else {
					n = parseInt( v.slice( 1 ) , 10 ) ;
					step = 10 ** ( -n ) ;
				}
			}
			else if ( v[ v.length - 1 ] === '.' ) {
				n = parseInt( v.slice( 0 , -1 ) , 10 ) ;
				step = 10 ** n ;
			}
			else {
				n = parseInt( v , 10 ) ;
				step = 10 ** ( Math.ceil( Math.log10( arg + Number.EPSILON ) + Number.EPSILON ) - n ) ;
			}
		}
	}

	if ( step ) { arg = round( arg , step ) ; }

	if ( toFixed !== undefined && ( ! toFixedIfDecimal || arg !== Math.trunc( arg ) ) ) {
		arg = arg.toFixed( toFixed ) ;
	}
	else {
		arg = '' + arg ;
	}

	if ( padding ) {
		n = arg.indexOf( '.' ) ;
		if ( n === -1 ) { n = arg.length ; }
		if ( n < padding ) { arg = '0'.repeat( padding - n ) + arg ; }
	}

	return arg ;
} ;

modes.f.noSanitize = true ;



// integer
modes.e = ( arg , modeArg ) => {
	if ( typeof arg === 'string' ) { arg = parseFloat( arg ) ; }
	if ( typeof arg !== 'number' ) { arg = 0 ; }

	if ( modeArg ) {
		return '' + arg.toExponential( parseInt( modeArg , 10 ) - 1 ) ;
	}

	return '' + arg.toExponential() ;

} ;

modes.e.noSanitize = true ;



// integer
modes.d = modes.i = arg => {
	if ( typeof arg === 'string' ) { arg = parseFloat( arg ) ; }
	if ( typeof arg === 'number' ) { return '' + Math.floor( arg ) ; }
	return '0' ;
} ;

modes.i.noSanitize = true ;



// unsigned integer
modes.u = arg => {
	if ( typeof arg === 'string' ) { arg = parseFloat( arg ) ; }
	if ( typeof arg === 'number' ) { return '' + Math.max( Math.floor( arg ) , 0 ) ; }
	return '0' ;
} ;

modes.u.noSanitize = true ;



// unsigned positive integer
modes.U = arg => {
	if ( typeof arg === 'string' ) { arg = parseFloat( arg ) ; }
	if ( typeof arg === 'number' ) { return '' + Math.max( Math.floor( arg ) , 1 ) ; }
	return '1' ;
} ;

modes.U.noSanitize = true ;



// metric system
modes.k = arg => {
	if ( typeof arg === 'string' ) { arg = parseFloat( arg ) ; }
	if ( typeof arg !== 'number' ) { return '0' ; }
	return metricPrefix( arg ) ;
} ;

modes.k.noSanitize = true ;



// time duration, transform ms into H:min:s
// Later it should format Date as well: number=duration, date object=date
// Note that it would not replace moment.js, but it could uses it.
modes.t = arg => {
	if ( typeof arg === 'string' ) { arg = parseFloat( arg ) ; }
	if ( typeof arg !== 'number' ) { return '(NaN)' ; }

	var s = Math.floor( arg / 1000 ) ;
	if ( s < 60 ) { return s + 's' ; }

	var min = Math.floor( s / 60 ) ;
	s = s % 60 ;
	if ( min < 60 ) { return min + 'min' + zeroPadding( s ) + 's' ; }

	var h = Math.floor( min / 60 ) ;
	min = min % 60 ;
	//if ( h < 24 ) { return h + 'h' + zeroPadding( min ) +'min' + zeroPadding( s ) + 's' ; }

	return h + 'h' + zeroPadding( min ) + 'min' + zeroPadding( s ) + 's' ;
} ;

modes.t.noSanitize = true ;

// Transform a number to a string, pad zero to the left if necessary
function zeroPadding( n , width = 2 ) {
	n = '' + n ;
	if ( n.length < width ) { n = '0'.repeat( width - n.length ) + n ; }
	return n ;
}


// unsigned hexadecimal
modes.h = arg => {
	if ( typeof arg === 'string' ) { arg = parseFloat( arg ) ; }
	if ( typeof arg === 'number' ) { return '' + Math.max( Math.floor( arg ) , 0 ).toString( 16 ) ; }
	return '0' ;
} ;

modes.h.noSanitize = true ;



// unsigned hexadecimal, force pair of symboles
modes.x = arg => {
	if ( typeof arg === 'string' ) { arg = parseFloat( arg ) ; }
	if ( typeof arg !== 'number' ) { return '0' ; }

	var value = '' + Math.max( Math.floor( arg ) , 0 ).toString( 16 ) ;

	if ( value.length % 2 ) { value = '0' + value ; }
	return value ;
} ;

modes.x.noSanitize = true ;



// unsigned octal
modes.o = arg => {
	if ( typeof arg === 'string' ) { arg = parseFloat( arg ) ; }
	if ( typeof arg === 'number' ) { return '' + Math.max( Math.floor( arg ) , 0 ).toString( 8 ) ; }
	return '0' ;
} ;

modes.o.noSanitize = true ;



// unsigned binary
modes.b = arg => {
	if ( typeof arg === 'string' ) { arg = parseFloat( arg ) ; }
	if ( typeof arg === 'number' ) { return '' + Math.max( Math.floor( arg ) , 0 ).toString( 2 ) ; }
	return '0' ;
} ;

modes.b.noSanitize = true ;



// base64
modes.z = arg => {
	if ( typeof arg === 'string' ) { arg = Buffer.from( arg ) ; }
	else if ( ! Buffer.isBuffer( arg ) ) { return '' ; }
	return arg.toString( 'base64' ) ;
} ;



// base64url
modes.Z = arg => {
	if ( typeof arg === 'string' ) { arg = Buffer.from( arg ) ; }
	else if ( ! Buffer.isBuffer( arg ) ) { return '' ; }
	return arg.toString( 'base64' ).replace( /\+/g , '-' )
		.replace( /\//g , '_' )
		.replace( /[=]{1,2}$/g , '' ) ;
} ;



// inspect
modes.I = ( arg , modeArg , options ) => {
	var depth = 3 ;
	if ( modeArg !== undefined ) { depth = parseInt( modeArg , 10 ) ; }
	return inspect( {
		depth: depth ,
		style: ( options && options.color ? 'color' : 'none' )
	} , arg ) ;
} ;

modes.I.noSanitize = true ;



// more minimalist inspect
modes.Y = ( arg , modeArg , options ) => {
	var depth = 3 ;
	if ( modeArg !== undefined ) { depth = parseInt( modeArg , 10 ) ; }
	return inspect( {
		depth: depth ,
		style: ( options && options.color ? 'color' : 'none' ) ,
		noFunc: true ,
		enumOnly: true ,
		noDescriptor: true ,
		useInspect: true
	} , arg ) ;
} ;

modes.Y.noSanitize = true ;



// inspect error
modes.E = ( arg , modeArg , options ) => inspectError( { style: ( options && options.color ? 'color' : 'none' ) } , arg ) ;
modes.E.noSanitize = true ;

// json
modes.J = arg => arg === undefined ? 'null' : JSON.stringify( arg ) ;

// drop
modes.D = () => '' ;
modes.D.noSanitize = true ;



var defaultFormatter = {
	argumentSanitizer: str => escape.control( str , true ) ,
	extraArguments: true ,
	color: false ,
	noMarkup: false ,
	endingMarkupReset: true ,
	startingMarkupReset: false ,
	markupReset: ansi.reset ,
	shiftMarkup: {
		'#': 'background'
	} ,
	markup: {
		":": ansi.reset ,
		" ": ansi.reset + " " ,

		"-": ansi.dim ,
		"+": ansi.bold ,
		"_": ansi.underline ,
		"/": ansi.italic ,
		"!": ansi.inverse ,

		"b": ansi.blue ,
		"B": ansi.brightBlue ,
		"c": ansi.cyan ,
		"C": ansi.brightCyan ,
		"g": ansi.green ,
		"G": ansi.brightGreen ,
		"k": ansi.black ,
		"K": ansi.brightBlack ,
		"m": ansi.magenta ,
		"M": ansi.brightMagenta ,
		"r": ansi.red ,
		"R": ansi.brightRed ,
		"w": ansi.white ,
		"W": ansi.brightWhite ,
		"y": ansi.yellow ,
		"Y": ansi.brightYellow
	} ,
	shiftedMarkup: {
		background: {
			":": ansi.reset ,
			" ": ansi.reset + " " ,

			"b": ansi.bgBlue ,
			"B": ansi.bgBrightBlue ,
			"c": ansi.bgCyan ,
			"C": ansi.bgBrightCyan ,
			"g": ansi.bgGreen ,
			"G": ansi.bgBrightGreen ,
			"k": ansi.bgBlack ,
			"K": ansi.bgBrightBlack ,
			"m": ansi.bgMagenta ,
			"M": ansi.bgBrightMagenta ,
			"r": ansi.bgRed ,
			"R": ansi.bgBrightRed ,
			"w": ansi.bgWhite ,
			"W": ansi.bgBrightWhite ,
			"y": ansi.bgYellow ,
			"Y": ansi.bgBrightYellow
		}
	}
} ;

exports.createFormatter = ( options ) => exports.formatMethod.bind( Object.assign( {} , defaultFormatter , options ) ) ;
exports.format = exports.formatMethod.bind( defaultFormatter ) ;
exports.format.default = defaultFormatter ;



exports.markupMethod = function markup_( str ) {
	if ( typeof str !== 'string' ) {
		if ( ! str ) { str = '' ; }
		else if ( typeof str.toString === 'function' ) { str = str.toString() ; }
		else { str = '' ; }
	}

	var hasMarkup = false , shift = null , markupStack = [] ;

	if ( this.markupReset && this.startingMarkupReset ) {
		str = ( typeof this.markupReset === 'function' ? this.markupReset( markupStack ) : this.markupReset ) + str ;
	}

	//console.log( 'format args:' , arguments ) ;

	str = str.replace( /\^(.?)/g , ( match , markup ) => {
		var replacement ;

		if ( markup === '^' ) { return '^' ; }

		if ( this.shiftMarkup && this.shiftMarkup[ markup ] ) {
			shift = this.shiftMarkup[ markup ] ;
			return '' ;
		}

		if ( shift ) {
			if ( ! this.shiftedMarkup || ! this.shiftedMarkup[ shift ] || ! this.shiftedMarkup[ shift ][ markup ] ) {
				return '' ;
			}

			hasMarkup = true ;

			if ( typeof this.shiftedMarkup[ shift ][ markup ] === 'function' ) {
				replacement = this.shiftedMarkup[ shift ][ markup ]( markupStack ) ;
				// method should manage markup stack themselves
			}
			else {
				replacement = this.shiftedMarkup[ shift ][ markup ] ;
				markupStack.push( replacement ) ;
			}

			shift = null ;
		}
		else {
			if ( ! this.markup || ! this.markup[ markup ] ) {
				return '' ;
			}

			hasMarkup = true ;

			if ( typeof this.markup[ markup ] === 'function' ) {
				replacement = this.markup[ markup ]( markupStack ) ;
				// method should manage markup stack themselves
			}
			else {
				replacement = this.markup[ markup ] ;
				markupStack.push( replacement ) ;
			}
		}

		return replacement ;
	} ) ;

	if ( hasMarkup && this.markupReset && this.endingMarkupReset ) {
		str += typeof this.markupReset === 'function' ? this.markupReset( markupStack ) : this.markupReset ;
	}

	return str ;
} ;



exports.createMarkup = ( options ) => exports.markupMethod.bind( Object.assign( {} , defaultFormatter , options ) ) ;
exports.markup = exports.markupMethod.bind( defaultFormatter ) ;



// Count the number of parameters needed for this string
exports.format.count = function formatCount( str ) {
	var match , index , relative , autoIndex = 1 , maxIndex = 0 ;

	if ( typeof str !== 'string' ) { return 0 ; }

	// This regex differs slightly from the main regex: we do not count '%%' and %F is excluded
	var regexp = /%([+-]?)([0-9]*)(?:\[([^\]]*)\])?([a-zA-EG-Z])/g ;


	while ( ( match = regexp.exec( str ) ) !== null ) {
		//console.log( match ) ;
		relative = match[ 1 ] ;
		index = match[ 2 ] ;

		if ( index ) {
			index = parseInt( index , 10 ) ;

			if ( relative ) {
				if ( relative === '+' ) { index = autoIndex + index ; }
				else if ( relative === '-' ) { index = autoIndex - index ; }
			}
		}
		else {
			index = autoIndex ;
		}

		autoIndex ++ ;

		if ( maxIndex < index ) { maxIndex = index ; }
	}

	return maxIndex ;
} ;



// Tell if this string contains formatter chars
exports.format.hasFormatting = function hasFormatting( str ) {
	if ( str.search( /\^(.?)|(%%)|%([+-]?)([0-9]*)(?:\[([^\]]*)\])?([a-zA-Z])/ ) !== -1 ) { return true ; }
	return false ;
} ;



// From math-kit module
const EPSILON = 0.0000000001 ;
const INVERSE_EPSILON = Math.round( 1 / EPSILON ) ;

function epsilonRound( v ) {
	return Math.round( v * INVERSE_EPSILON ) / INVERSE_EPSILON ;
}

// Round with precision
function round( v , step ) {
	// use: v * ( 1 / step )
	// not: v / step
	// reason: epsilon rounding errors
	return epsilonRound( step * Math.round( v * ( 1 / step ) ) ) ;
}



// Metric prefix
const MUL_PREFIX = [ '' , 'k' , 'M' , 'G' , 'T' , 'P' , 'E' , 'Z' , 'Y' ] ;
const SUB_MUL_PREFIX = [ '' , 'm' , 'µ' , 'n' , 'p' , 'f' , 'a' , 'z' , 'y' ] ;
const IROUND_STEP = [ 100 , 10 , 1 ] ;



function metricPrefix( n ) {
	var log , logDiv3 , logMod , base , prefix ;

	if ( ! n || n === 1 ) { return '' + n ; }
	if ( n < 0 ) { return '-' + metricPrefix( -n ) ; }

	if ( n > 1 ) {
		log = Math.floor( Math.log10( n ) ) ;
		logDiv3 = Math.floor( log / 3 ) ;
		logMod = log % 3 ;
		base = iround( n / ( Math.pow( 1000 , logDiv3 ) ) , IROUND_STEP[ logMod ] ) ;
		prefix = MUL_PREFIX[ logDiv3 ] ;
	}
	else {
		log = Math.floor( Math.log10( n ) ) ;
		logDiv3 = Math.floor( log / 3 ) ;
		logMod = log % 3 ;
		if ( logMod < 0 ) { logMod += 3 ; }
		base = iround( n / ( Math.pow( 1000 , logDiv3 ) ) , IROUND_STEP[ logMod ] ) ;
		prefix = SUB_MUL_PREFIX[ -logDiv3 ] ;
	}

	return '' + base + prefix ;
}



function iround( v , istep ) {
	return Math.round( ( v + Number.EPSILON ) * istep ) / istep ;
}


}).call(this,require("buffer").Buffer)
},{"./ansi.js":16,"./escape.js":18,"./inspect.js":20,"buffer":40}],20:[function(require,module,exports){
(function (Buffer,process){
/*
	String Kit

	Copyright (c) 2014 - 2019 Cédric Ronvel

	The MIT License (MIT)

	Permission is hereby granted, free of charge, to any person obtaining a copy
	of this software and associated documentation files (the "Software"), to deal
	in the Software without restriction, including without limitation the rights
	to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
	copies of the Software, and to permit persons to whom the Software is
	furnished to do so, subject to the following conditions:

	The above copyright notice and this permission notice shall be included in all
	copies or substantial portions of the Software.

	THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
	IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
	FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
	AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
	LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
	OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
	SOFTWARE.
*/

/*
	Variable inspector.
*/



"use strict" ;



const escape = require( './escape.js' ) ;
const ansi = require( './ansi.js' ) ;

const EMPTY = {} ;



/*
	Inspect a variable, return a string ready to be displayed with console.log(), or even as an HTML output.

	Options:
		* style:
			* 'none': (default) normal output suitable for console.log() or writing in a file
			* 'inline': like 'none', but without newlines
			* 'color': colorful output suitable for terminal
			* 'html': html output
			* any object: full controle, inheriting from 'none'
		* depth: depth limit, default: 3
		* maxLength: length limit for strings, default: 250
		* outputMaxLength: length limit for the inspect output string, default: 5000
		* noFunc: do not display functions
		* noDescriptor: do not display descriptor information
		* noArrayProperty: do not display array properties
		* noType: do not display type and constructor
		* enumOnly: only display enumerable properties
		* funcDetails: display function's details
		* proto: display object's prototype
		* sort: sort the keys
		* minimal: imply noFunc: true, noDescriptor: true, noType: true, enumOnly: true, proto: false and funcDetails: false.
		  Display a minimal JSON-like output
		* protoBlackList: `Set` of blacklisted object prototype (will not recurse inside it)
		* propertyBlackList: `Set` of blacklisted property names (will not even display it)
		* useInspect: use .inspect() method when available on an object (default to false)
*/

function inspect( options , variable ) {
	if ( arguments.length < 2 ) { variable = options ; options = {} ; }
	else if ( ! options || typeof options !== 'object' ) { options = {} ; }

	var runtime = { depth: 0 , ancestors: [] } ;

	if ( ! options.style ) { options.style = inspectStyle.none ; }
	else if ( typeof options.style === 'string' ) { options.style = inspectStyle[ options.style ] ; }
	// Too slow:
	//else { options.style = Object.assign( {} , inspectStyle.none , options.style ) ; }

	if ( options.depth === undefined ) { options.depth = 3 ; }
	if ( options.maxLength === undefined ) { options.maxLength = 250 ; }
	if ( options.outputMaxLength === undefined ) { options.outputMaxLength = 5000 ; }

	// /!\ nofunc is deprecated
	if ( options.nofunc ) { options.noFunc = true ; }

	if ( options.minimal ) {
		options.noFunc = true ;
		options.noDescriptor = true ;
		options.noType = true ;
		options.noArrayProperty = true ;
		options.enumOnly = true ;
		options.funcDetails = false ;
		options.proto = false ;
	}

	var str = inspect_( runtime , options , variable ) ;

	if ( str.length > options.outputMaxLength ) {
		str = options.style.truncate( str , options.outputMaxLength ) ;
	}

	return str ;
}



function inspect_( runtime , options , variable ) {
	var i , funcName , length , proto , propertyList , constructor , keyIsProperty ,
		type , pre , indent , isArray , isFunc , specialObject ,
		str = '' , key = '' , descriptorStr = '' , descriptor , nextAncestors ;


	// Prepare things (indentation, key, descriptor, ... )

	type = typeof variable ;
	indent = options.style.tab.repeat( runtime.depth ) ;

	if ( type === 'function' && options.noFunc ) { return '' ; }

	if ( runtime.key !== undefined ) {
		if ( runtime.descriptor ) {
			descriptorStr = [] ;

			if ( ! runtime.descriptor.configurable ) { descriptorStr.push( '-conf' ) ; }
			if ( ! runtime.descriptor.enumerable ) { descriptorStr.push( '-enum' ) ; }

			// Already displayed by runtime.forceType
			//if ( runtime.descriptor.get || runtime.descriptor.set ) { descriptorStr.push( 'getter/setter' ) ; } else
			if ( ! runtime.descriptor.writable ) { descriptorStr.push( '-w' ) ; }

			//if ( descriptorStr.length ) { descriptorStr = '(' + descriptorStr.join( ' ' ) + ')' ; }
			if ( descriptorStr.length ) { descriptorStr = descriptorStr.join( ' ' ) ; }
			else { descriptorStr = '' ; }
		}

		if ( runtime.keyIsProperty ) {
			if ( keyNeedingQuotes( runtime.key ) ) {
				key = '"' + options.style.key( runtime.key ) + '": ' ;
			}
			else {
				key = options.style.key( runtime.key ) + ': ' ;
			}
		}
		else {
			key = options.style.index( runtime.key ) ;
		}

		if ( descriptorStr ) { descriptorStr = ' ' + options.style.type( descriptorStr ) ; }
	}

	pre = runtime.noPre ? '' : indent + key ;


	// Describe the current variable

	if ( variable === undefined ) {
		str += pre + options.style.constant( 'undefined' ) + descriptorStr + options.style.newline ;
	}
	else if ( variable === EMPTY ) {
		str += pre + options.style.constant( '[empty]' ) + descriptorStr + options.style.newline ;
	}
	else if ( variable === null ) {
		str += pre + options.style.constant( 'null' ) + descriptorStr + options.style.newline ;
	}
	else if ( variable === false ) {
		str += pre + options.style.constant( 'false' ) + descriptorStr + options.style.newline ;
	}
	else if ( variable === true ) {
		str += pre + options.style.constant( 'true' ) + descriptorStr + options.style.newline ;
	}
	else if ( type === 'number' ) {
		str += pre + options.style.number( variable.toString() ) +
			( options.noType ? '' : ' ' + options.style.type( 'number' ) ) +
			descriptorStr + options.style.newline ;
	}
	else if ( type === 'string' ) {
		if ( variable.length > options.maxLength ) {
			str += pre + '"' + options.style.string( escape.control( variable.slice( 0 , options.maxLength - 1 ) ) ) + '…"' +
				( options.noType ? '' : ' ' + options.style.type( 'string' ) + options.style.length( '(' + variable.length + ' - TRUNCATED)' ) ) +
				descriptorStr + options.style.newline ;
		}
		else {
			str += pre + '"' + options.style.string( escape.control( variable ) ) + '"' +
				( options.noType ? '' : ' ' + options.style.type( 'string' ) + options.style.length( '(' + variable.length + ')' ) ) +
				descriptorStr + options.style.newline ;
		}
	}
	else if ( Buffer.isBuffer( variable ) ) {
		str += pre + options.style.inspect( variable.inspect() ) +
			( options.noType ? '' : ' ' + options.style.type( 'Buffer' ) + options.style.length( '(' + variable.length + ')' ) ) +
			descriptorStr + options.style.newline ;
	}
	else if ( type === 'object' || type === 'function' ) {
		funcName = length = '' ;
		isFunc = false ;

		if ( type === 'function' ) {
			isFunc = true ;
			funcName = ' ' + options.style.funcName( ( variable.name ? variable.name : '(anonymous)' ) ) ;
			length = options.style.length( '(' + variable.length + ')' ) ;
		}

		isArray = false ;

		if ( Array.isArray( variable ) ) {
			isArray = true ;
			length = options.style.length( '(' + variable.length + ')' ) ;
		}

		if ( ! variable.constructor ) { constructor = '(no constructor)' ; }
		else if ( ! variable.constructor.name ) { constructor = '(anonymous)' ; }
		else { constructor = variable.constructor.name ; }

		constructor = options.style.constructorName( constructor ) ;
		proto = Object.getPrototypeOf( variable ) ;

		str += pre ;

		if ( ! options.noType ) {
			if ( runtime.forceType ) { str += options.style.type( runtime.forceType ) ; }
			else { str += constructor + funcName + length + ' ' + options.style.type( type ) + descriptorStr ; }

			if ( ! isFunc || options.funcDetails ) { str += ' ' ; }	// if no funcDetails imply no space here
		}

		if ( isArray && options.noArrayProperty ) {
			propertyList = [ ... Array( variable.length ).keys() ] ;
		}
		else {
			propertyList = Object.getOwnPropertyNames( variable ) ;
		}

		if ( options.sort ) { propertyList.sort() ; }

		// Special Objects
		specialObject = specialObjectSubstitution( variable , runtime , options ) ;

		if ( options.protoBlackList && options.protoBlackList.has( proto ) ) {
			str += options.style.limit( '[skip]' ) + options.style.newline ;
		}
		else if ( specialObject !== undefined ) {
			if ( typeof specialObject === 'string' ) {
				str += '=> ' + specialObject + options.style.newline ;
			}
			else {
				str += '=> ' + inspect_(
					{
						depth: runtime.depth ,
						ancestors: runtime.ancestors ,
						noPre: true
					} ,
					options ,
					specialObject
				) ;
			}
		}
		else if ( isFunc && ! options.funcDetails ) {
			str += options.style.newline ;
		}
		else if ( ! propertyList.length && ! options.proto ) {
			str += ( isArray ? '[]' : '{}' ) + options.style.newline ;
		}
		else if ( runtime.depth >= options.depth ) {
			str += options.style.limit( '[depth limit]' ) + options.style.newline ;
		}
		else if ( runtime.ancestors.indexOf( variable ) !== -1 ) {
			str += options.style.limit( '[circular]' ) + options.style.newline ;
		}
		else {
			str += ( isArray && options.noType && options.noArrayProperty ? '[' : '{' ) + options.style.newline ;

			// Do not use .concat() here, it doesn't works as expected with arrays...
			nextAncestors = runtime.ancestors.slice() ;
			nextAncestors.push( variable ) ;

			for ( i = 0 ; i < propertyList.length && str.length < options.outputMaxLength ; i ++ ) {
				if ( ! isArray && options.propertyBlackList && options.propertyBlackList.has( propertyList[ i ] ) ) {
					//str += options.style.limit( '[skip]' ) + options.style.newline ;
					continue ;
				}

				if ( isArray && options.noArrayProperty && ! ( propertyList[ i ] in variable ) ) {
					// Hole in the array (sparse array, item deleted, ...)
					str += inspect_(
						{
							depth: runtime.depth + 1 ,
							ancestors: nextAncestors ,
							key: propertyList[ i ] ,
							keyIsProperty: false
						} ,
						options ,
						EMPTY
					) ;
				}
				else {
					try {
						descriptor = Object.getOwnPropertyDescriptor( variable , propertyList[ i ] ) ;
						if ( ! descriptor.enumerable && options.enumOnly ) { continue ; }
						keyIsProperty = ! isArray || ! descriptor.enumerable || isNaN( propertyList[ i ] ) ;

						if ( ! options.noDescriptor && descriptor && ( descriptor.get || descriptor.set ) ) {
							str += inspect_(
								{
									depth: runtime.depth + 1 ,
									ancestors: nextAncestors ,
									key: propertyList[ i ] ,
									keyIsProperty: keyIsProperty ,
									descriptor: descriptor ,
									forceType: 'getter/setter'
								} ,
								options ,
								{ get: descriptor.get , set: descriptor.set }
							) ;
						}
						else {
							str += inspect_(
								{
									depth: runtime.depth + 1 ,
									ancestors: nextAncestors ,
									key: propertyList[ i ] ,
									keyIsProperty: keyIsProperty ,
									descriptor: options.noDescriptor ? undefined : descriptor
								} ,
								options ,
								variable[ propertyList[ i ] ]
							) ;
						}
					}
					catch ( error ) {
						str += inspect_(
							{
								depth: runtime.depth + 1 ,
								ancestors: nextAncestors ,
								key: propertyList[ i ] ,
								keyIsProperty: keyIsProperty ,
								descriptor: options.noDescriptor ? undefined : descriptor
							} ,
							options ,
							error
						) ;
					}
				}

				if ( i < propertyList.length - 1 ) { str += options.style.comma ; }
			}

			if ( options.proto ) {
				str += inspect_(
					{
						depth: runtime.depth + 1 ,
						ancestors: nextAncestors ,
						key: '__proto__' ,
						keyIsProperty: true
					} ,
					options ,
					proto
				) ;
			}

			str += indent + ( isArray && options.noType && options.noArrayProperty ? ']' : '}' ) ;
			str += options.style.newline ;
		}
	}


	// Finalizing


	if ( runtime.depth === 0 ) {
		if ( options.style.trim ) { str = str.trim() ; }
		if ( options.style === 'html' ) { str = escape.html( str ) ; }
	}

	return str ;
}

exports.inspect = inspect ;



function keyNeedingQuotes( key ) {
	if ( ! key.length ) { return true ; }
	return false ;
}



var promiseStates = [ 'pending' , 'fulfilled' , 'rejected' ] ;



// Some special object are better written down when substituted by something else
function specialObjectSubstitution( object , runtime , options ) {
	if ( typeof object.constructor !== 'function' ) {
		// Some objects have no constructor, e.g.: Object.create(null)
		//console.error( object ) ;
		return ;
	}

	if ( object instanceof String ) {
		return object.toString() ;
	}

	if ( object instanceof RegExp ) {
		return object.toString() ;
	}

	if ( object instanceof Date ) {
		return object.toString() + ' [' + object.getTime() + ']' ;
	}

	if ( typeof Set === 'function' && object instanceof Set ) {
		// This is an ES6 'Set' Object
		return Array.from( object ) ;
	}

	if ( typeof Map === 'function' && object instanceof Map ) {
		// This is an ES6 'Map' Object
		return Array.from( object ) ;
	}

	if ( object instanceof Promise ) {
		if ( process && process.binding && process.binding( 'util' ) && process.binding( 'util' ).getPromiseDetails ) {
			let details = process.binding( 'util' ).getPromiseDetails( object ) ;
			let state =  promiseStates[ details[ 0 ] ] ;
			let str = 'Promise <' + state + '>' ;

			if ( state === 'fulfilled' ) {
				str += ' ' + inspect_(
					{
						depth: runtime.depth ,
						ancestors: runtime.ancestors ,
						noPre: true
					} ,
					options ,
					details[ 1 ]
				) ;
			}
			else if ( state === 'rejected' ) {
				if ( details[ 1 ] instanceof Error ) {
					str += ' ' + inspectError(
						{
							style: options.style ,
							noErrorStack: true
						} ,
						details[ 1 ]
					) ;
				}
				else {
					str += ' ' + inspect_(
						{
							depth: runtime.depth ,
							ancestors: runtime.ancestors ,
							noPre: true
						} ,
						options ,
						details[ 1 ]
					) ;
				}
			}

			return str ;
		}
	}

	if ( object._bsontype ) {
		// This is a MongoDB ObjectID, rather boring to display in its original form
		// due to esoteric characters that confuse both the user and the terminal displaying it.
		// Substitute it to its string representation
		return object.toString() ;
	}

	if ( options.useInspect && typeof object.inspect === 'function' ) {
		return object.inspect() ;
	}

	return ;
}



/*
	Options:
		noErrorStack: set to true if the stack should not be displayed
*/
function inspectError( options , error ) {
	var str = '' , stack , type , code ;

	if ( arguments.length < 2 ) { error = options ; options = {} ; }
	else if ( ! options || typeof options !== 'object' ) { options = {} ; }

	if ( ! ( error instanceof Error ) ) {
		return 'inspectError: not an error -- regular variable inspection: ' + inspect( options , error ) ;
	}

	if ( ! options.style ) { options.style = inspectStyle.none ; }
	else if ( typeof options.style === 'string' ) { options.style = inspectStyle[ options.style ] ; }

	if ( error.stack && ! options.noErrorStack ) { stack = inspectStack( options , error.stack ) ; }

	type = error.type || error.constructor.name ;
	code = error.code || error.name || error.errno || error.number ;

	str += options.style.errorType( type ) +
		( code ? ' [' + options.style.errorType( code ) + ']' : '' ) + ': ' ;
	str += options.style.errorMessage( error.message ) + '\n' ;

	if ( stack ) { str += options.style.errorStack( stack ) + '\n' ; }

	if ( error.from ) {
		str += options.style.newline + options.style.errorFromMessage( 'Error created from:' ) + options.style.newline + inspectError( options , error.from ) ;
	}

	return str ;
}

exports.inspectError = inspectError ;



function inspectStack( options , stack ) {
	if ( arguments.length < 2 ) { stack = options ; options = {} ; }
	else if ( ! options || typeof options !== 'object' ) { options = {} ; }

	if ( ! options.style ) { options.style = inspectStyle.none ; }
	else if ( typeof options.style === 'string' ) { options.style = inspectStyle[ options.style ] ; }

	if ( ! stack ) { return ; }

	if ( ( options.browser || process.browser ) && stack.indexOf( '@' ) !== -1 ) {
		// Assume a Firefox-compatible stack-trace here...
		stack = stack
			.replace( /[</]*(?=@)/g , '' )	// Firefox output some WTF </</</</< stuff in its stack trace -- removing that
			.replace(
				/^\s*([^@]*)\s*@\s*([^\n]*)(?::([0-9]+):([0-9]+))?$/mg ,
				( matches , method , file , line , column ) => {
					return options.style.errorStack( '    at ' ) +
						( method ? options.style.errorStackMethod( method ) + ' ' : '' ) +
						options.style.errorStack( '(' ) +
						( file ? options.style.errorStackFile( file ) : options.style.errorStack( 'unknown' ) ) +
						( line ? options.style.errorStack( ':' ) + options.style.errorStackLine( line ) : '' ) +
						( column ? options.style.errorStack( ':' ) + options.style.errorStackColumn( column ) : '' ) +
						options.style.errorStack( ')' ) ;
				}
			) ;
	}
	else {
		stack = stack.replace( /^[^\n]*\n/ , '' ) ;
		stack = stack.replace(
			/^\s*(at)\s+(?:((?:new +)?[^\s:()[\]\n]+(?:\([^)]+\))?)\s)?(?:\[as ([^\s:()[\]\n]+)\]\s)?(?:\(?([^:()[\]\n]+):([0-9]+):([0-9]+)\)?)?$/mg ,
			( matches , at , method , as , file , line , column ) => {
				return options.style.errorStack( '    at ' ) +
					( method ? options.style.errorStackMethod( method ) + ' ' : '' ) +
					( as ? options.style.errorStack( '[as ' ) + options.style.errorStackMethodAs( as ) + options.style.errorStack( '] ' ) : '' ) +
					options.style.errorStack( '(' ) +
					( file ? options.style.errorStackFile( file ) : options.style.errorStack( 'unknown' ) ) +
					( line ? options.style.errorStack( ':' ) + options.style.errorStackLine( line ) : '' ) +
					( column ? options.style.errorStack( ':' ) + options.style.errorStackColumn( column ) : '' ) +
					options.style.errorStack( ')' ) ;
			}
		) ;
	}

	return stack ;
}

exports.inspectStack = inspectStack ;



// Inspect's styles

var inspectStyle = {} ;

var inspectStyleNoop = str => str ;



inspectStyle.none = {
	trim: false ,
	tab: '    ' ,
	newline: '\n' ,
	comma: '' ,
	limit: inspectStyleNoop ,
	type: str => '<' + str + '>' ,
	constant: inspectStyleNoop ,
	funcName: inspectStyleNoop ,
	constructorName: str => '<' + str + '>' ,
	length: inspectStyleNoop ,
	key: inspectStyleNoop ,
	index: str => '[' + str + '] ' ,
	number: inspectStyleNoop ,
	inspect: inspectStyleNoop ,
	string: inspectStyleNoop ,
	errorType: inspectStyleNoop ,
	errorMessage: inspectStyleNoop ,
	errorStack: inspectStyleNoop ,
	errorStackMethod: inspectStyleNoop ,
	errorStackMethodAs: inspectStyleNoop ,
	errorStackFile: inspectStyleNoop ,
	errorStackLine: inspectStyleNoop ,
	errorStackColumn: inspectStyleNoop ,
	errorFromMessage: inspectStyleNoop ,
	truncate: ( str , maxLength ) => str.slice( 0 , maxLength - 1 ) + '…'
} ;



inspectStyle.inline = Object.assign( {} , inspectStyle.none , {
	trim: true ,
	tab: '' ,
	newline: ' ' ,
	comma: ', ' ,
	length: () => '' ,
	index: () => ''
	//type: () => '' ,
} ) ;



inspectStyle.color = Object.assign( {} , inspectStyle.none , {
	limit: str => ansi.bold + ansi.brightRed + str + ansi.reset ,
	type: str => ansi.italic + ansi.brightBlack + str + ansi.reset ,
	constant: str => ansi.cyan + str + ansi.reset ,
	funcName: str => ansi.italic + ansi.magenta + str + ansi.reset ,
	constructorName: str => ansi.magenta + str + ansi.reset ,
	length: str => ansi.italic + ansi.brightBlack + str + ansi.reset ,
	key: str => ansi.green + str + ansi.reset ,
	index: str => ansi.blue + '[' + str + ']' + ansi.reset + ' ' ,
	number: str => ansi.cyan + str + ansi.reset ,
	inspect: str => ansi.cyan + str + ansi.reset ,
	string: str => ansi.blue + str + ansi.reset ,
	errorType: str => ansi.red + ansi.bold + str + ansi.reset ,
	errorMessage: str => ansi.red + ansi.italic + str + ansi.reset ,
	errorStack: str => ansi.brightBlack + str + ansi.reset ,
	errorStackMethod: str => ansi.brightYellow + str + ansi.reset ,
	errorStackMethodAs: str => ansi.yellow + str + ansi.reset ,
	errorStackFile: str => ansi.brightCyan + str + ansi.reset ,
	errorStackLine: str => ansi.blue + str + ansi.reset ,
	errorStackColumn: str => ansi.magenta + str + ansi.reset ,
	errorFromMessage: str => ansi.yellow + ansi.underline + str + ansi.reset ,
	truncate: ( str , maxLength ) => {
		var trail = ansi.gray + '…' + ansi.reset ;
		str = str.slice( 0 , maxLength - trail.length ) ;

		// Search for an ansi escape sequence at the end, that could be truncated.
		// The longest one is '\x1b[107m': 6 characters.
		var lastEscape = str.lastIndexOf( '\x1b' ) ;
		if ( lastEscape >= str.length - 6 ) { str = str.slice( 0 , lastEscape ) ; }

		return str + trail ;
	}
} ) ;



inspectStyle.html = Object.assign( {} , inspectStyle.none , {
	tab: '&nbsp;&nbsp;&nbsp;&nbsp;' ,
	newline: '<br />' ,
	limit: str => '<span style="color:red">' + str + '</span>' ,
	type: str => '<i style="color:gray">' + str + '</i>' ,
	constant: str => '<span style="color:cyan">' + str + '</span>' ,
	funcName: str => '<i style="color:magenta">' + str + '</i>' ,
	constructorName: str => '<span style="color:magenta">' + str + '</span>' ,
	length: str => '<i style="color:gray">' + str + '</i>' ,
	key: str => '<span style="color:green">' + str + '</span>' ,
	index: str => '<span style="color:blue">[' + str + ']</span> ' ,
	number: str => '<span style="color:cyan">' + str + '</span>' ,
	inspect: str => '<span style="color:cyan">' + str + '</span>' ,
	string: str => '<span style="color:blue">' + str + '</span>' ,
	errorType: str => '<span style="color:red">' + str + '</span>' ,
	errorMessage: str => '<span style="color:red">' + str + '</span>' ,
	errorStack: str => '<span style="color:gray">' + str + '</span>' ,
	errorStackMethod: str => '<span style="color:yellow">' + str + '</span>' ,
	errorStackMethodAs: str => '<span style="color:yellow">' + str + '</span>' ,
	errorStackFile: str => '<span style="color:cyan">' + str + '</span>' ,
	errorStackLine: str => '<span style="color:blue">' + str + '</span>' ,
	errorStackColumn: str => '<span style="color:gray">' + str + '</span>' ,
	errorFromMessage: str => '<span style="color:yellow">' + str + '</span>'
} ) ;


}).call(this,{"isBuffer":require("../../../../../../../../opt/node.js-v10.13.0/lib/node_modules/browserify/node_modules/is-buffer/index.js")},require('_process'))
},{"../../../../../../../../opt/node.js-v10.13.0/lib/node_modules/browserify/node_modules/is-buffer/index.js":43,"./ansi.js":16,"./escape.js":18,"_process":46}],21:[function(require,module,exports){
module.exports={"߀":"0","́":""," ":" ","Ⓐ":"A","Ａ":"A","À":"A","Á":"A","Â":"A","Ầ":"A","Ấ":"A","Ẫ":"A","Ẩ":"A","Ã":"A","Ā":"A","Ă":"A","Ằ":"A","Ắ":"A","Ẵ":"A","Ẳ":"A","Ȧ":"A","Ǡ":"A","Ä":"A","Ǟ":"A","Ả":"A","Å":"A","Ǻ":"A","Ǎ":"A","Ȁ":"A","Ȃ":"A","Ạ":"A","Ậ":"A","Ặ":"A","Ḁ":"A","Ą":"A","Ⱥ":"A","Ɐ":"A","Ꜳ":"AA","Æ":"AE","Ǽ":"AE","Ǣ":"AE","Ꜵ":"AO","Ꜷ":"AU","Ꜹ":"AV","Ꜻ":"AV","Ꜽ":"AY","Ⓑ":"B","Ｂ":"B","Ḃ":"B","Ḅ":"B","Ḇ":"B","Ƀ":"B","Ɓ":"B","ｃ":"C","Ⓒ":"C","Ｃ":"C","Ꜿ":"C","Ḉ":"C","Ç":"C","Ⓓ":"D","Ｄ":"D","Ḋ":"D","Ď":"D","Ḍ":"D","Ḑ":"D","Ḓ":"D","Ḏ":"D","Đ":"D","Ɗ":"D","Ɖ":"D","ᴅ":"D","Ꝺ":"D","Ð":"Dh","Ǳ":"DZ","Ǆ":"DZ","ǲ":"Dz","ǅ":"Dz","ɛ":"E","Ⓔ":"E","Ｅ":"E","È":"E","É":"E","Ê":"E","Ề":"E","Ế":"E","Ễ":"E","Ể":"E","Ẽ":"E","Ē":"E","Ḕ":"E","Ḗ":"E","Ĕ":"E","Ė":"E","Ë":"E","Ẻ":"E","Ě":"E","Ȅ":"E","Ȇ":"E","Ẹ":"E","Ệ":"E","Ȩ":"E","Ḝ":"E","Ę":"E","Ḙ":"E","Ḛ":"E","Ɛ":"E","Ǝ":"E","ᴇ":"E","ꝼ":"F","Ⓕ":"F","Ｆ":"F","Ḟ":"F","Ƒ":"F","Ꝼ":"F","Ⓖ":"G","Ｇ":"G","Ǵ":"G","Ĝ":"G","Ḡ":"G","Ğ":"G","Ġ":"G","Ǧ":"G","Ģ":"G","Ǥ":"G","Ɠ":"G","Ꞡ":"G","Ᵹ":"G","Ꝿ":"G","ɢ":"G","Ⓗ":"H","Ｈ":"H","Ĥ":"H","Ḣ":"H","Ḧ":"H","Ȟ":"H","Ḥ":"H","Ḩ":"H","Ḫ":"H","Ħ":"H","Ⱨ":"H","Ⱶ":"H","Ɥ":"H","Ⓘ":"I","Ｉ":"I","Ì":"I","Í":"I","Î":"I","Ĩ":"I","Ī":"I","Ĭ":"I","İ":"I","Ï":"I","Ḯ":"I","Ỉ":"I","Ǐ":"I","Ȉ":"I","Ȋ":"I","Ị":"I","Į":"I","Ḭ":"I","Ɨ":"I","Ⓙ":"J","Ｊ":"J","Ĵ":"J","Ɉ":"J","ȷ":"J","Ⓚ":"K","Ｋ":"K","Ḱ":"K","Ǩ":"K","Ḳ":"K","Ķ":"K","Ḵ":"K","Ƙ":"K","Ⱪ":"K","Ꝁ":"K","Ꝃ":"K","Ꝅ":"K","Ꞣ":"K","Ⓛ":"L","Ｌ":"L","Ŀ":"L","Ĺ":"L","Ľ":"L","Ḷ":"L","Ḹ":"L","Ļ":"L","Ḽ":"L","Ḻ":"L","Ł":"L","Ƚ":"L","Ɫ":"L","Ⱡ":"L","Ꝉ":"L","Ꝇ":"L","Ꞁ":"L","Ǉ":"LJ","ǈ":"Lj","Ⓜ":"M","Ｍ":"M","Ḿ":"M","Ṁ":"M","Ṃ":"M","Ɱ":"M","Ɯ":"M","ϻ":"M","Ꞥ":"N","Ƞ":"N","Ⓝ":"N","Ｎ":"N","Ǹ":"N","Ń":"N","Ñ":"N","Ṅ":"N","Ň":"N","Ṇ":"N","Ņ":"N","Ṋ":"N","Ṉ":"N","Ɲ":"N","Ꞑ":"N","ᴎ":"N","Ǌ":"NJ","ǋ":"Nj","Ⓞ":"O","Ｏ":"O","Ò":"O","Ó":"O","Ô":"O","Ồ":"O","Ố":"O","Ỗ":"O","Ổ":"O","Õ":"O","Ṍ":"O","Ȭ":"O","Ṏ":"O","Ō":"O","Ṑ":"O","Ṓ":"O","Ŏ":"O","Ȯ":"O","Ȱ":"O","Ö":"O","Ȫ":"O","Ỏ":"O","Ő":"O","Ǒ":"O","Ȍ":"O","Ȏ":"O","Ơ":"O","Ờ":"O","Ớ":"O","Ỡ":"O","Ở":"O","Ợ":"O","Ọ":"O","Ộ":"O","Ǫ":"O","Ǭ":"O","Ø":"O","Ǿ":"O","Ɔ":"O","Ɵ":"O","Ꝋ":"O","Ꝍ":"O","Œ":"OE","Ƣ":"OI","Ꝏ":"OO","Ȣ":"OU","Ⓟ":"P","Ｐ":"P","Ṕ":"P","Ṗ":"P","Ƥ":"P","Ᵽ":"P","Ꝑ":"P","Ꝓ":"P","Ꝕ":"P","Ⓠ":"Q","Ｑ":"Q","Ꝗ":"Q","Ꝙ":"Q","Ɋ":"Q","Ⓡ":"R","Ｒ":"R","Ŕ":"R","Ṙ":"R","Ř":"R","Ȑ":"R","Ȓ":"R","Ṛ":"R","Ṝ":"R","Ŗ":"R","Ṟ":"R","Ɍ":"R","Ɽ":"R","Ꝛ":"R","Ꞧ":"R","Ꞃ":"R","Ⓢ":"S","Ｓ":"S","ẞ":"S","Ś":"S","Ṥ":"S","Ŝ":"S","Ṡ":"S","Š":"S","Ṧ":"S","Ṣ":"S","Ṩ":"S","Ș":"S","Ş":"S","Ȿ":"S","Ꞩ":"S","Ꞅ":"S","Ⓣ":"T","Ｔ":"T","Ṫ":"T","Ť":"T","Ṭ":"T","Ț":"T","Ţ":"T","Ṱ":"T","Ṯ":"T","Ŧ":"T","Ƭ":"T","Ʈ":"T","Ⱦ":"T","Ꞇ":"T","Þ":"Th","Ꜩ":"TZ","Ⓤ":"U","Ｕ":"U","Ù":"U","Ú":"U","Û":"U","Ũ":"U","Ṹ":"U","Ū":"U","Ṻ":"U","Ŭ":"U","Ü":"U","Ǜ":"U","Ǘ":"U","Ǖ":"U","Ǚ":"U","Ủ":"U","Ů":"U","Ű":"U","Ǔ":"U","Ȕ":"U","Ȗ":"U","Ư":"U","Ừ":"U","Ứ":"U","Ữ":"U","Ử":"U","Ự":"U","Ụ":"U","Ṳ":"U","Ų":"U","Ṷ":"U","Ṵ":"U","Ʉ":"U","Ⓥ":"V","Ｖ":"V","Ṽ":"V","Ṿ":"V","Ʋ":"V","Ꝟ":"V","Ʌ":"V","Ꝡ":"VY","Ⓦ":"W","Ｗ":"W","Ẁ":"W","Ẃ":"W","Ŵ":"W","Ẇ":"W","Ẅ":"W","Ẉ":"W","Ⱳ":"W","Ⓧ":"X","Ｘ":"X","Ẋ":"X","Ẍ":"X","Ⓨ":"Y","Ｙ":"Y","Ỳ":"Y","Ý":"Y","Ŷ":"Y","Ỹ":"Y","Ȳ":"Y","Ẏ":"Y","Ÿ":"Y","Ỷ":"Y","Ỵ":"Y","Ƴ":"Y","Ɏ":"Y","Ỿ":"Y","Ⓩ":"Z","Ｚ":"Z","Ź":"Z","Ẑ":"Z","Ż":"Z","Ž":"Z","Ẓ":"Z","Ẕ":"Z","Ƶ":"Z","Ȥ":"Z","Ɀ":"Z","Ⱬ":"Z","Ꝣ":"Z","ⓐ":"a","ａ":"a","ẚ":"a","à":"a","á":"a","â":"a","ầ":"a","ấ":"a","ẫ":"a","ẩ":"a","ã":"a","ā":"a","ă":"a","ằ":"a","ắ":"a","ẵ":"a","ẳ":"a","ȧ":"a","ǡ":"a","ä":"a","ǟ":"a","ả":"a","å":"a","ǻ":"a","ǎ":"a","ȁ":"a","ȃ":"a","ạ":"a","ậ":"a","ặ":"a","ḁ":"a","ą":"a","ⱥ":"a","ɐ":"a","ɑ":"a","ꜳ":"aa","æ":"ae","ǽ":"ae","ǣ":"ae","ꜵ":"ao","ꜷ":"au","ꜹ":"av","ꜻ":"av","ꜽ":"ay","ⓑ":"b","ｂ":"b","ḃ":"b","ḅ":"b","ḇ":"b","ƀ":"b","ƃ":"b","ɓ":"b","Ƃ":"b","ⓒ":"c","ć":"c","ĉ":"c","ċ":"c","č":"c","ç":"c","ḉ":"c","ƈ":"c","ȼ":"c","ꜿ":"c","ↄ":"c","C":"c","Ć":"c","Ĉ":"c","Ċ":"c","Č":"c","Ƈ":"c","Ȼ":"c","ⓓ":"d","ｄ":"d","ḋ":"d","ď":"d","ḍ":"d","ḑ":"d","ḓ":"d","ḏ":"d","đ":"d","ƌ":"d","ɖ":"d","ɗ":"d","Ƌ":"d","Ꮷ":"d","ԁ":"d","Ɦ":"d","ð":"dh","ǳ":"dz","ǆ":"dz","ⓔ":"e","ｅ":"e","è":"e","é":"e","ê":"e","ề":"e","ế":"e","ễ":"e","ể":"e","ẽ":"e","ē":"e","ḕ":"e","ḗ":"e","ĕ":"e","ė":"e","ë":"e","ẻ":"e","ě":"e","ȅ":"e","ȇ":"e","ẹ":"e","ệ":"e","ȩ":"e","ḝ":"e","ę":"e","ḙ":"e","ḛ":"e","ɇ":"e","ǝ":"e","ⓕ":"f","ｆ":"f","ḟ":"f","ƒ":"f","ﬀ":"ff","ﬁ":"fi","ﬂ":"fl","ﬃ":"ffi","ﬄ":"ffl","ⓖ":"g","ｇ":"g","ǵ":"g","ĝ":"g","ḡ":"g","ğ":"g","ġ":"g","ǧ":"g","ģ":"g","ǥ":"g","ɠ":"g","ꞡ":"g","ꝿ":"g","ᵹ":"g","ⓗ":"h","ｈ":"h","ĥ":"h","ḣ":"h","ḧ":"h","ȟ":"h","ḥ":"h","ḩ":"h","ḫ":"h","ẖ":"h","ħ":"h","ⱨ":"h","ⱶ":"h","ɥ":"h","ƕ":"hv","ⓘ":"i","ｉ":"i","ì":"i","í":"i","î":"i","ĩ":"i","ī":"i","ĭ":"i","ï":"i","ḯ":"i","ỉ":"i","ǐ":"i","ȉ":"i","ȋ":"i","ị":"i","į":"i","ḭ":"i","ɨ":"i","ı":"i","ⓙ":"j","ｊ":"j","ĵ":"j","ǰ":"j","ɉ":"j","ⓚ":"k","ｋ":"k","ḱ":"k","ǩ":"k","ḳ":"k","ķ":"k","ḵ":"k","ƙ":"k","ⱪ":"k","ꝁ":"k","ꝃ":"k","ꝅ":"k","ꞣ":"k","ⓛ":"l","ｌ":"l","ŀ":"l","ĺ":"l","ľ":"l","ḷ":"l","ḹ":"l","ļ":"l","ḽ":"l","ḻ":"l","ſ":"l","ł":"l","ƚ":"l","ɫ":"l","ⱡ":"l","ꝉ":"l","ꞁ":"l","ꝇ":"l","ɭ":"l","ǉ":"lj","ⓜ":"m","ｍ":"m","ḿ":"m","ṁ":"m","ṃ":"m","ɱ":"m","ɯ":"m","ⓝ":"n","ｎ":"n","ǹ":"n","ń":"n","ñ":"n","ṅ":"n","ň":"n","ṇ":"n","ņ":"n","ṋ":"n","ṉ":"n","ƞ":"n","ɲ":"n","ŉ":"n","ꞑ":"n","ꞥ":"n","ԉ":"n","ǌ":"nj","ⓞ":"o","ｏ":"o","ò":"o","ó":"o","ô":"o","ồ":"o","ố":"o","ỗ":"o","ổ":"o","õ":"o","ṍ":"o","ȭ":"o","ṏ":"o","ō":"o","ṑ":"o","ṓ":"o","ŏ":"o","ȯ":"o","ȱ":"o","ö":"o","ȫ":"o","ỏ":"o","ő":"o","ǒ":"o","ȍ":"o","ȏ":"o","ơ":"o","ờ":"o","ớ":"o","ỡ":"o","ở":"o","ợ":"o","ọ":"o","ộ":"o","ǫ":"o","ǭ":"o","ø":"o","ǿ":"o","ꝋ":"o","ꝍ":"o","ɵ":"o","ɔ":"o","ᴑ":"o","œ":"oe","ƣ":"oi","ꝏ":"oo","ȣ":"ou","ⓟ":"p","ｐ":"p","ṕ":"p","ṗ":"p","ƥ":"p","ᵽ":"p","ꝑ":"p","ꝓ":"p","ꝕ":"p","ρ":"p","ⓠ":"q","ｑ":"q","ɋ":"q","ꝗ":"q","ꝙ":"q","ⓡ":"r","ｒ":"r","ŕ":"r","ṙ":"r","ř":"r","ȑ":"r","ȓ":"r","ṛ":"r","ṝ":"r","ŗ":"r","ṟ":"r","ɍ":"r","ɽ":"r","ꝛ":"r","ꞧ":"r","ꞃ":"r","ⓢ":"s","ｓ":"s","ś":"s","ṥ":"s","ŝ":"s","ṡ":"s","š":"s","ṧ":"s","ṣ":"s","ṩ":"s","ș":"s","ş":"s","ȿ":"s","ꞩ":"s","ꞅ":"s","ẛ":"s","ʂ":"s","ß":"ss","ⓣ":"t","ｔ":"t","ṫ":"t","ẗ":"t","ť":"t","ṭ":"t","ț":"t","ţ":"t","ṱ":"t","ṯ":"t","ŧ":"t","ƭ":"t","ʈ":"t","ⱦ":"t","ꞇ":"t","þ":"th","ꜩ":"tz","ⓤ":"u","ｕ":"u","ù":"u","ú":"u","û":"u","ũ":"u","ṹ":"u","ū":"u","ṻ":"u","ŭ":"u","ü":"u","ǜ":"u","ǘ":"u","ǖ":"u","ǚ":"u","ủ":"u","ů":"u","ű":"u","ǔ":"u","ȕ":"u","ȗ":"u","ư":"u","ừ":"u","ứ":"u","ữ":"u","ử":"u","ự":"u","ụ":"u","ṳ":"u","ų":"u","ṷ":"u","ṵ":"u","ʉ":"u","ⓥ":"v","ｖ":"v","ṽ":"v","ṿ":"v","ʋ":"v","ꝟ":"v","ʌ":"v","ꝡ":"vy","ⓦ":"w","ｗ":"w","ẁ":"w","ẃ":"w","ŵ":"w","ẇ":"w","ẅ":"w","ẘ":"w","ẉ":"w","ⱳ":"w","ⓧ":"x","ｘ":"x","ẋ":"x","ẍ":"x","ⓨ":"y","ｙ":"y","ỳ":"y","ý":"y","ŷ":"y","ỹ":"y","ȳ":"y","ẏ":"y","ÿ":"y","ỷ":"y","ẙ":"y","ỵ":"y","ƴ":"y","ɏ":"y","ỿ":"y","ⓩ":"z","ｚ":"z","ź":"z","ẑ":"z","ż":"z","ž":"z","ẓ":"z","ẕ":"z","ƶ":"z","ȥ":"z","ɀ":"z","ⱬ":"z","ꝣ":"z"}
},{}],22:[function(require,module,exports){
/*
	String Kit

	Copyright (c) 2014 - 2019 Cédric Ronvel

	The MIT License (MIT)

	Permission is hereby granted, free of charge, to any person obtaining a copy
	of this software and associated documentation files (the "Software"), to deal
	in the Software without restriction, including without limitation the rights
	to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
	copies of the Software, and to permit persons to whom the Software is
	furnished to do so, subject to the following conditions:

	The above copyright notice and this permission notice shall be included in all
	copies or substantial portions of the Software.

	THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
	IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
	FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
	AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
	LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
	OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
	SOFTWARE.
*/

"use strict" ;



var map = require( './latinize-map.json' ) ;

module.exports = function( str ) {
	return str.replace( /[^\u0000-\u007e]/g , ( c ) => { return map[ c ] || c ; } ) ;
} ;



},{"./latinize-map.json":21}],23:[function(require,module,exports){
/*
	String Kit

	Copyright (c) 2014 - 2019 Cédric Ronvel

	The MIT License (MIT)

	Permission is hereby granted, free of charge, to any person obtaining a copy
	of this software and associated documentation files (the "Software"), to deal
	in the Software without restriction, including without limitation the rights
	to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
	copies of the Software, and to permit persons to whom the Software is
	furnished to do so, subject to the following conditions:

	The above copyright notice and this permission notice shall be included in all
	copies or substantial portions of the Software.

	THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
	IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
	FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
	AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
	LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
	OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
	SOFTWARE.
*/

"use strict" ;



exports.resize = function resize( str , length ) {
	if ( str.length === length ) {
		return str ;
	}
	else if ( str.length > length ) {
		return str.slice( 0 , length ) ;
	}

	return str + ' '.repeat( length - str.length ) ;

} ;



exports.occurenceCount = function occurenceCount( str , subStr ) {
	if ( ! str || ! subStr ) { return 0 ; }

	var count = 0 , index = 0 ;

	while ( ( index = str.indexOf( subStr , index ) ) !== -1 ) {
		count ++ ;
		index += subStr.length ;
	}

	return count ;
} ;



},{}],24:[function(require,module,exports){
/*
	HTTP Requester

	Copyright (c) 2015 - 2019 Cédric Ronvel

	The MIT License (MIT)

	Permission is hereby granted, free of charge, to any person obtaining a copy
	of this software and associated documentation files (the "Software"), to deal
	in the Software without restriction, including without limitation the rights
	to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
	copies of the Software, and to permit persons to whom the Software is
	furnished to do so, subject to the following conditions:

	The above copyright notice and this permission notice shall be included in all
	copies or substantial portions of the Software.

	THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
	IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
	FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
	AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
	LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
	OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
	SOFTWARE.
*/

"use strict" ;



/*
 * Natural Sort algorithm for Javascript - Version 0.8 - Released under MIT license
 * Author: Jim Palmer (based on chunking idea from Dave Koelle)
 */
module.exports = function( a , b ) {
	var re = /(^([+-]?(?:\d*)(?:\.\d*)?(?:[eE][+-]?\d+)?)?$|^0x[\da-fA-F]+$|\d+)/g ,
		sre = /^\s+|\s+$/g ,   // trim pre-post whitespace
		snre = /\s+/g ,        // normalize all whitespace to single ' ' character
		dre = /(^([\w ]+,?[\w ]+)?[\w ]+,?[\w ]+\d+:\d+(:\d+)?[\w ]?|^\d{1,4}[/-]\d{1,4}[/-]\d{1,4}|^\w+, \w+ \d+, \d{4})/ ,
		hre = /^0x[0-9a-f]+$/i ,
		ore = /^0/ ,
		i = function( s ) {
			return ( '' + s ).toLowerCase().replace( sre , '' ) ;
		} ,
		// convert all to strings strip whitespace
		x = i( a ) || '' ,
		y = i( b ) || '' ,
		// chunk/tokenize
		xN = x.replace( re , '\0$1\0' ).replace( /\0$/ , '' )
			.replace( /^\0/ , '' )
			.split( '\0' ) ,
		yN = y.replace( re , '\0$1\0' ).replace( /\0$/ , '' )
			.replace( /^\0/ , '' )
			.split( '\0' ) ,
		// numeric, hex or date detection
		xD = parseInt( x.match( hre ) , 16 ) || ( xN.length !== 1 && Date.parse( x ) ) ,
		yD = parseInt( y.match( hre ) , 16 ) || xD && y.match( dre ) && Date.parse( y ) || null ,
		normChunk = function( s , l ) {
			// normalize spaces; find floats not starting with '0', string or 0 if not defined (Clint Priest)
			return ( ! s.match( ore ) || l === 1 ) && parseFloat( s ) || s.replace( snre , ' ' ).replace( sre , '' ) || 0 ;	// jshint ignore:line
		} ,
		oFxNcL , oFyNcL ;
	// first try and sort Hex codes or Dates
	if ( yD ) {
		if ( xD < yD ) { return -1 ; }
		else if ( xD > yD ) { return 1 ; }
	}
	// natural sorting through split numeric strings and default strings
	for( var cLoc = 0 , xNl = xN.length , yNl = yN.length , numS = Math.max( xNl , yNl ) ; cLoc < numS ; cLoc ++ ) {
		oFxNcL = normChunk( xN[cLoc] , xNl ) ;
		oFyNcL = normChunk( yN[cLoc] , yNl ) ;
		// handle numeric vs string comparison - number < string - (Kyle Adams)
		if ( isNaN( oFxNcL ) !== isNaN( oFyNcL ) ) { return ( isNaN( oFxNcL ) ) ? 1 : -1 ; }
		// rely on string comparison if different types - i.e. '02' < 2 != '02' < '2'
		else if ( typeof oFxNcL !== typeof oFyNcL ) {
			oFxNcL += '' ;
			oFyNcL += '' ;
		}
		if ( oFxNcL < oFyNcL ) { return -1 ; }
		if ( oFxNcL > oFyNcL ) { return 1 ; }
	}
	return 0 ;
} ;


},{}],25:[function(require,module,exports){
/*
	String Kit

	Copyright (c) 2014 - 2019 Cédric Ronvel

	The MIT License (MIT)

	Permission is hereby granted, free of charge, to any person obtaining a copy
	of this software and associated documentation files (the "Software"), to deal
	in the Software without restriction, including without limitation the rights
	to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
	copies of the Software, and to permit persons to whom the Software is
	furnished to do so, subject to the following conditions:

	The above copyright notice and this permission notice shall be included in all
	copies or substantial portions of the Software.

	THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
	IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
	FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
	AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
	LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
	OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
	SOFTWARE.
*/

"use strict" ;



/* All polyfill borrowed from MDN: developer.mozilla.org */



var polyfill = {} ;
module.exports = polyfill ;



// https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/String/repeat
polyfill.repeat = function( count ) {
	if ( this === null ) {
		throw new TypeError( 'can\'t convert ' + this + ' to object' ) ;
	}
	var str = '' + this ;
	count = + count ;
	if ( count !== count ) {
		count = 0 ;
	}
	if ( count < 0 ) {
		throw new RangeError( 'repeat count must be non-negative' ) ;
	}
	if ( count === Infinity ) {
		throw new RangeError( 'repeat count must be less than infinity' ) ;
	}
	count = Math.floor( count ) ;
	if ( str.length === 0 || count === 0 ) {
		return '' ;
	}
	// Ensuring count is a 31-bit integer allows us to heavily optimize the
	// main part. But anyway, most current (August 2014) browsers can't handle
	// strings 1 << 28 chars or longer, so:
	if ( str.length * count >= 1 << 28 ) {
		throw new RangeError( 'repeat count must not overflow maximum string size' ) ;
	}
	var rpt = '' ;
	for ( ;; ) {
		if ( ( count & 1 ) === 1 ) {
			rpt += str ;
		}
		count >>>= 1 ;
		if ( count === 0 ) {
			break ;
		}
		str += str ;
	}
	return rpt ;
} ;



},{}],26:[function(require,module,exports){
/*
	String Kit

	Copyright (c) 2014 - 2019 Cédric Ronvel

	The MIT License (MIT)

	Permission is hereby granted, free of charge, to any person obtaining a copy
	of this software and associated documentation files (the "Software"), to deal
	in the Software without restriction, including without limitation the rights
	to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
	copies of the Software, and to permit persons to whom the Software is
	furnished to do so, subject to the following conditions:

	The above copyright notice and this permission notice shall be included in all
	copies or substantial portions of the Software.

	THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
	IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
	FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
	AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
	LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
	OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
	SOFTWARE.
*/

"use strict" ;



var escape = require( './escape.js' ) ;



exports.regexp = {} ;



exports.regexp.array2alternatives = function array2alternatives( array ) {
	var i , sorted = array.slice() ;

	// Sort descending by string length
	sorted.sort( ( a , b ) => {
		return b.length - a.length ;
	} ) ;

	// Then escape what should be
	for ( i = 0 ; i < sorted.length ; i ++ ) {
		sorted[ i ] = escape.regExpPattern( sorted[ i ] ) ;
	}

	return sorted.join( '|' ) ;
} ;



},{"./escape.js":18}],27:[function(require,module,exports){
/*
	String Kit

	Copyright (c) 2014 - 2019 Cédric Ronvel

	The MIT License (MIT)

	Permission is hereby granted, free of charge, to any person obtaining a copy
	of this software and associated documentation files (the "Software"), to deal
	in the Software without restriction, including without limitation the rights
	to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
	copies of the Software, and to permit persons to whom the Software is
	furnished to do so, subject to the following conditions:

	The above copyright notice and this permission notice shall be included in all
	copies or substantial portions of the Software.

	THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
	IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
	FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
	AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
	LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
	OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
	SOFTWARE.
*/

"use strict" ;



var stringKit = {} ;
module.exports = stringKit ;



// Tier 0: add polyfills to stringKit
var fn_ ;
var polyfill = require( './polyfill.js' ) ;

for ( fn_ in polyfill ) {
	stringKit[ fn_ ] = function( str , ... args ) {
		return polyfill[ fn_ ].call( str , ... args ) ;
	} ;
}



Object.assign( stringKit ,

	// Tier 1
	{ escape: require( './escape.js' ) } ,
	{ ansi: require( './ansi.js' ) } ,
	{ unicode: require( './unicode.js' ) }
) ;



Object.assign( stringKit ,

	// Tier 2
	require( './format.js' ) ,

	// Tier 3
	require( './misc.js' ) ,
	require( './inspect.js' ) ,
	require( './regexp.js' ) ,
	require( './camel.js' ) ,
	{
		latinize: require( './latinize.js' ) ,
		toTitleCase: require( './toTitleCase.js' ) ,
		wordwrap: require( './wordwrap.js' ) ,
		naturalSort: require( './naturalSort.js' )
	}
) ;



// Install all polyfill into String.prototype
stringKit.installPolyfills = function installPolyfills() {
	var fn ;

	for ( fn in polyfill ) {
		if ( ! String.prototype[ fn ] ) {
			String.prototype[ fn ] = polyfill[ fn ] ;
		}
	}
} ;


},{"./ansi.js":16,"./camel.js":17,"./escape.js":18,"./format.js":19,"./inspect.js":20,"./latinize.js":22,"./misc.js":23,"./naturalSort.js":24,"./polyfill.js":25,"./regexp.js":26,"./toTitleCase.js":28,"./unicode.js":29,"./wordwrap.js":30}],28:[function(require,module,exports){
/*
	String Kit

	Copyright (c) 2014 - 2019 Cédric Ronvel

	The MIT License (MIT)

	Permission is hereby granted, free of charge, to any person obtaining a copy
	of this software and associated documentation files (the "Software"), to deal
	in the Software without restriction, including without limitation the rights
	to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
	copies of the Software, and to permit persons to whom the Software is
	furnished to do so, subject to the following conditions:

	The above copyright notice and this permission notice shall be included in all
	copies or substantial portions of the Software.

	THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
	IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
	FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
	AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
	LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
	OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
	SOFTWARE.
*/

"use strict" ;



module.exports = function toTitleCase( str , options ) {
	if ( ! str || typeof str !== 'string' ) { return '' ; }

	options = options || {} ;

	return str.replace( /[^\s_-]+/g , ( part ) => {
		if ( options.zealous ) {
			if ( options.preserveAllCaps && part === part.toUpperCase() ) {
				// This is a ALLCAPS word
				return part ;
			}

			return part[ 0 ].toUpperCase() + part.slice( 1 ).toLowerCase() ;

		}

		return part[ 0 ].toUpperCase() + part.slice( 1 ) ;

	} ) ;
} ;



},{}],29:[function(require,module,exports){
/*
	String Kit

	Copyright (c) 2014 - 2019 Cédric Ronvel

	The MIT License (MIT)

	Permission is hereby granted, free of charge, to any person obtaining a copy
	of this software and associated documentation files (the "Software"), to deal
	in the Software without restriction, including without limitation the rights
	to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
	copies of the Software, and to permit persons to whom the Software is
	furnished to do so, subject to the following conditions:

	The above copyright notice and this permission notice shall be included in all
	copies or substantial portions of the Software.

	THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
	IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
	FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
	AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
	LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
	OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
	SOFTWARE.
*/

"use strict" ;



/*
	Javascript does not use UTF-8 but UCS-2.
	The purpose of this module is to process correctly strings containing UTF-8 characters that take more than 2 bytes.

	Since the punycode module is deprecated in Node.js v8.x, this is an adaptation of punycode.ucs2.x
	as found on Aug 16th 2017 at: https://github.com/bestiejs/punycode.js/blob/master/punycode.js.
*/



// Create the module and export it
const unicode = {} ;
module.exports = unicode ;



unicode.encode = array => String.fromCodePoint( ... array ) ;



// Decode a string into an array of unicode codepoints
unicode.decode = str => {
	var value , extra , counter = 0 , output = [] ,
		length = str.length ;

	while ( counter < length ) {
		value = str.charCodeAt( counter ++ ) ;

		if ( value >= 0xD800 && value <= 0xDBFF && counter < length ) {
			// It's a high surrogate, and there is a next character.
			extra = str.charCodeAt( counter ++ ) ;

			if ( ( extra & 0xFC00 ) === 0xDC00 ) {	// Low surrogate.
				output.push( ( ( value & 0x3FF ) << 10 ) + ( extra & 0x3FF ) + 0x10000 ) ;
			}
			else {
				// It's an unmatched surrogate; only append this code unit, in case the
				// next code unit is the high surrogate of a surrogate pair.
				output.push( value ) ;
				counter -- ;
			}
		}
		else {
			output.push( value ) ;
		}
	}

	return output ;
} ;



// Decode only the first char
// Mostly an adaptation of .decode(), not factorized for performance's sake (used by Terminal-kit)
unicode.firstCodePoint = str => {
	var extra ,
		value = str.charCodeAt( 0 ) ;

	if ( value >= 0xD800 && value <= 0xDBFF && str.length >= 2 ) {
		// It's a high surrogate, and there is a next character.
		extra = str.charCodeAt( 1 ) ;

		if ( ( extra & 0xFC00 ) === 0xDC00 ) {	// Low surrogate.
			return ( ( value & 0x3FF ) << 10 ) + ( extra & 0x3FF ) + 0x10000 ;
		}
	}

	return value ;
} ;



// Extract only the first char
// Mostly an adaptation of .decode(), not factorized for performance's sake (used by Terminal-kit)
unicode.firstChar = str => {
	var extra ,
		value = str.charCodeAt( 0 ) ;

	if ( value >= 0xD800 && value <= 0xDBFF && str.length >= 2 ) {
		// It's a high surrogate, and there is a next character.
		extra = str.charCodeAt( 1 ) ;

		if ( ( extra & 0xFC00 ) === 0xDC00 ) {	// Low surrogate.
			return str.slice( 0 , 2 ) ;
		}
	}

	return str[ 0 ] ;
} ;



// Decode a string into an array of unicode characters
// Mostly an adaptation of .decode(), not factorized for performance's sake (used by Terminal-kit)
unicode.toArray = str => {
	var value , extra , counter = 0 , output = [] ,
		length = str.length ;

	while ( counter < length ) {
		value = str.charCodeAt( counter ++ ) ;

		if ( value >= 0xD800 && value <= 0xDBFF && counter < length ) {
			// It's a high surrogate, and there is a next character.
			extra = str.charCodeAt( counter ++ ) ;

			if ( ( extra & 0xFC00 ) === 0xDC00 ) {	// Low surrogate.
				output.push( str.slice( counter - 2 , counter ) ) ;
			}
			else {
				// It's an unmatched surrogate; only append this code unit, in case the
				// next code unit is the high surrogate of a surrogate pair.
				output.push( str[ counter - 2 ] ) ;
				counter -- ;
			}
		}
		else {
			output.push( str[ counter - 1 ] ) ;
		}
	}

	return output ;
} ;



// Decode a string into an array of unicode characters
// Wide chars have an additionnal filler cell, so position is correct
// Mostly an adaptation of .decode(), not factorized for performance's sake (used by Terminal-kit)
unicode.toCells = ( Cell , str , tabWidth = 4 , linePosition = 0 , ... extraCellArgs ) => {
	var value , extra , counter = 0 , output = [] ,
		fillSize ,
		length = str.length ;

	while ( counter < length ) {
		value = str.charCodeAt( counter ++ ) ;

		if ( value === 0x0a ) {	// New line
			linePosition = 0 ;
		}
		else if ( value === 0x09 ) {	// Tab
			// Depends upon the next tab-stop
			fillSize = tabWidth - ( linePosition % tabWidth ) - 1 ;
			output.push( new Cell( '\t' , ... extraCellArgs ) ) ;
			linePosition += 1 + fillSize ;
			while ( fillSize -- ) { output.push( new Cell( null , ... extraCellArgs ) ) ; }
		}
		else if ( value >= 0xD800 && value <= 0xDBFF && counter < length ) {
			// It's a high surrogate, and there is a next character.
			extra = str.charCodeAt( counter ++ ) ;

			if ( ( extra & 0xFC00 ) === 0xDC00 ) {	// Low surrogate.
				value = ( ( value & 0x3FF ) << 10 ) + ( extra & 0x3FF ) + 0x10000 ;
				output.push(  new Cell( str.slice( counter - 2 , counter ) , ... extraCellArgs )  ) ;
				linePosition ++ ;

				if ( unicode.codePointWidth( value ) === 2 ) {
					linePosition ++ ;
					output.push( new Cell( null , ... extraCellArgs ) ) ;
				}
			}
			else {
				// It's an unmatched surrogate, remove it.
				// Preserve current char in case the next code unit is the high surrogate of a surrogate pair.
				counter -- ;
			}
		}
		else {
			output.push(  new Cell( str[ counter - 1 ] , ... extraCellArgs )  ) ;
			linePosition ++ ;

			if ( unicode.codePointWidth( value ) === 2 ) {
				output.push( new Cell( null , ... extraCellArgs ) ) ;
				linePosition ++ ;
			}
		}
	}

	return output ;
} ;



unicode.fromCells = ( cells ) => {
	return cells.map( cell => cell.filler ? '' : cell.char ).join( '' ) ;
} ;



// Get the length of an unicode string
// Mostly an adaptation of .decode(), not factorized for performance's sake (used by Terminal-kit)
unicode.length = str => {
	var value , extra , counter = 0 , uLength = 0 ,
		length = str.length ;

	while ( counter < length ) {
		value = str.charCodeAt( counter ++ ) ;

		if ( value >= 0xD800 && value <= 0xDBFF && counter < length ) {
			// It's a high surrogate, and there is a next character.
			extra = str.charCodeAt( counter ++ ) ;

			if ( ( extra & 0xFC00 ) !== 0xDC00 ) {
				// It's an unmatched surrogate; only append this code unit, in case the
				// next code unit is the high surrogate of a surrogate pair.
				counter -- ;
			}
		}

		uLength ++ ;
	}

	return uLength ;
} ;



// Return the width of a string in a terminal/monospace font
unicode.width = str => {
	var count = 0 ;
	unicode.decode( str ).forEach( code => count += unicode.codePointWidth( code ) ) ;
	return count ;
} ;



// Return the width of an array of string in a terminal/monospace font
unicode.arrayWidth = ( array , limit ) => {
	var index , count = 0 ;

	if ( limit === undefined ) { limit = array.length ; }

	for ( index = 0 ; index < limit ; index ++ ) {
		count += unicode.isFullWidth( array[ index ] ) ? 2 : 1 ;
	}

	return count ;
} ;



// Return a string that does not exceed the limit
// Mostly an adaptation of .decode(), not factorized for performance's sake (used by Terminal-kit)
unicode.widthLimit =	// DEPRECATED
unicode.truncateWidth = ( str , limit ) => {
	var value , extra , counter = 0 , lastCounter = 0 , width = 0 ,
		length = str.length ;

	while ( counter < length ) {
		value = str.charCodeAt( counter ++ ) ;

		if ( value >= 0xD800 && value <= 0xDBFF && counter < length ) {
			// It's a high surrogate, and there is a next character.
			extra = str.charCodeAt( counter ++ ) ;

			if ( ( extra & 0xFC00 ) === 0xDC00 ) {	// Low surrogate.
				value = ( ( value & 0x3FF ) << 10 ) + ( extra & 0x3FF ) + 0x10000 ;
			}
			else {
				// It's an unmatched surrogate; only append this code unit, in case the
				// next code unit is the high surrogate of a surrogate pair.
				counter -- ;
			}
		}

		width += unicode.codePointWidth( value ) ;

		if ( width > limit ) {
			return str.slice( 0 , lastCounter ) ;
		}

		lastCounter = counter ;
	}

	// The string remains unchanged
	return str ;
} ;



/*
	Returns:
		0: single char
		1: leading surrogate
		-1: trailing surrogate

	Note: it does not check input, to gain perfs.
*/
unicode.surrogatePair = char => {
	var code = char.charCodeAt( 0 ) ;

	if ( code < 0xd800 || code >= 0xe000 ) { return 0 ; }
	else if ( code < 0xdc00 ) { return 1 ; }
	return -1 ;
} ;



/*
	Check if a character is a full-width char or not.
*/
unicode.isFullWidth = char => {
	if ( char.length <= 1 ) { return unicode.isFullWidthCodePoint( char.codePointAt( 0 ) ) ; }
	return unicode.isFullWidthCodePoint( unicode.firstCodePoint( char ) ) ;
} ;


// Return the width of a char, leaner than .width() for one char
unicode.charWidth = char => {
	if ( char.length <= 1 ) { return unicode.codePointWidth( char.codePointAt( 0 ) ) ; }
	return unicode.codePointWidth( unicode.firstCodePoint( char ) ) ;
} ;



/*
	Check if a codepoint represent a full-width char or not.

	Borrowed from Node.js source, from readline.js.
*/
unicode.codePointWidth = code => {
	// Code points are derived from:
	// http://www.unicode.org/Public/UNIDATA/EastAsianWidth.txt
	if ( code >= 0x1100 && (
		code <= 0x115f ||	// Hangul Jamo
			0x2329 === code || // LEFT-POINTING ANGLE BRACKET
			0x232a === code || // RIGHT-POINTING ANGLE BRACKET
			// CJK Radicals Supplement .. Enclosed CJK Letters and Months
			( 0x2e80 <= code && code <= 0x3247 && code !== 0x303f ) ||
			// Enclosed CJK Letters and Months .. CJK Unified Ideographs Extension A
			0x3250 <= code && code <= 0x4dbf ||
			// CJK Unified Ideographs .. Yi Radicals
			0x4e00 <= code && code <= 0xa4c6 ||
			// Hangul Jamo Extended-A
			0xa960 <= code && code <= 0xa97c ||
			// Hangul Syllables
			0xac00 <= code && code <= 0xd7a3 ||
			// CJK Compatibility Ideographs
			0xf900 <= code && code <= 0xfaff ||
			// Vertical Forms
			0xfe10 <= code && code <= 0xfe19 ||
			// CJK Compatibility Forms .. Small Form Variants
			0xfe30 <= code && code <= 0xfe6b ||
			// Halfwidth and Fullwidth Forms
			0xff01 <= code && code <= 0xff60 ||
			0xffe0 <= code && code <= 0xffe6 ||
			// Kana Supplement
			0x1b000 <= code && code <= 0x1b001 ||
			// Enclosed Ideographic Supplement
			0x1f200 <= code && code <= 0x1f251 ||
			// CJK Unified Ideographs Extension B .. Tertiary Ideographic Plane
			0x20000 <= code && code <= 0x3fffd ) ) {
		return 2 ;
	}

	return 1 ;
} ;

// For a true/false type of result
unicode.isFullWidthCodePoint = code => unicode.codePointWidth( code ) === 2 ;



// Convert normal ASCII chars to their full-width counterpart
unicode.toFullWidth = str => {
	return String.fromCodePoint( ... unicode.decode( str ).map( code =>
		code >= 33 && code <= 126  ?  0xff00 + code - 0x20  :  code
	) ) ;
} ;


},{}],30:[function(require,module,exports){
/*
	String Kit

	Copyright (c) 2014 - 2019 Cédric Ronvel

	The MIT License (MIT)

	Permission is hereby granted, free of charge, to any person obtaining a copy
	of this software and associated documentation files (the "Software"), to deal
	in the Software without restriction, including without limitation the rights
	to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
	copies of the Software, and to permit persons to whom the Software is
	furnished to do so, subject to the following conditions:

	The above copyright notice and this permission notice shall be included in all
	copies or substantial portions of the Software.

	THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
	IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
	FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
	AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
	LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
	OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
	SOFTWARE.
*/

"use strict" ;



var unicode = require( './unicode.js' ) ;



// French typography rules with '!', '?', ':' and ';'
const FRENCH_DOUBLE_GRAPH_TYPO = {
	'!': true ,
	'?': true ,
	':': true ,
	';': true
} ;



/*
	.wordwrap( str , width )
	.wordwrap( str , options )

	str: the string to process
	width: the max width (default to 80)
	options: object, where:
		width: the max width (default to 80)
		glue: (optional) the char to join lines, by default: lines are joined with '\n',
		noJoin: (optional) if set: don't join, instead return an array of lines
		offset: (optional) offset of the first-line
		updateOffset: (optional) if set, options.offset is updated with the last line width
		noTrim: (optional) if set, don't right-trim lines, if not set, right-trim all lines except the last
		fill: (optional) if set, fill the remaining width with space (it forces noTrim)
		skipFn: (optional) a function used to skip a whole sequence, useful for special sequences
			like ANSI escape sequence, and so on...
		charWidthFn: (optional) a function used to compute the width of one char/group of chars
		regroupFn: (optional) a function used to regroup chars together
*/
module.exports = function wordwrap( str , options ) {
	var start = 0 , end , skipEnd , lineWidth , currentLine , currentWidth , length ,
		lastEnd , lastWidth , lastWasSpace , charWidthFn ,
		explicitNewLine = true ,
		strArray = unicode.toArray( str ) ,
		trimNewLine = false ,
		line , lines = [] ;

	if ( typeof options !== 'object' ) {
		options = { width: options } ;
	}

	// Catch NaN, zero or negative and non-number
	if ( ! options.width || typeof options.width !== 'number' || options.width <= 0 ) { options.width = 80 ; }

	lineWidth = options.offset ? options.width - options.offset : options.width ;

	if ( typeof options.glue !== 'string' ) { options.glue = '\n' ; }

	if ( options.regroupFn ) {
		strArray = options.regroupFn( strArray ) ;
		// If char are grouped, use unicode.width() as a default
		charWidthFn = options.widthFn || unicode.width ;
	}
	else {
		// If char are not grouped, use unicode.charWidth() as a default
		charWidthFn = options.widthFn || unicode.charWidth ;
	}

	length = strArray.length ;

	var getNextLine = () => {
		//originStart = start ;

		if ( ! explicitNewLine || trimNewLine ) {
			// Find the first non-space char
			while ( strArray[ start ] === ' ' ) { start ++ ; }

			if ( trimNewLine && strArray[ start ] === '\n' ) {
				explicitNewLine = true ;
				start ++ ;
				/*
				originStart = start ;
				while ( strArray[ start ] === ' ' ) { start ++ ; }
				*/
			}
		}

		if ( start >= length ) { return null ; }

		explicitNewLine = false ;
		trimNewLine = false ;
		lastWasSpace = false ;
		end = lastEnd = start ;
		currentWidth = lastWidth = 0 ;

		for ( ;; ) {
			if ( end >= length ) {
				return strArray.slice( start , end ).join( '' ) ;
			}

			if ( strArray[ end ] === '\n' ) {
				explicitNewLine = true ;
				currentLine = strArray.slice( start , end ++ ).join( '' ) ;

				if ( options.fill ) {
					currentLine += ' '.repeat( lineWidth - currentWidth ) ;
				}

				return currentLine ;
			}

			if ( options.skipFn ) {
				skipEnd = options.skipFn( strArray , end ) ;
				if ( skipEnd !== end ) {
					end = skipEnd ;
					continue ;
				}
			}

			if ( strArray[ end ] === ' ' && ! lastWasSpace && ! FRENCH_DOUBLE_GRAPH_TYPO[ strArray[ end + 1 ] ] ) {
				// This is the first space of a group of space
				lastEnd = end ;
				lastWidth = currentWidth ;
			}
			else {
				lastWasSpace = false ;
			}

			currentWidth += charWidthFn( strArray[ end ] ) ;

			if ( currentWidth > lineWidth ) {
				// If lastEnd === start, this is a word that takes the whole line: cut it
				// If not, use the lastEnd
				trimNewLine = true ;

				if ( lastEnd !== start ) {
					end = lastEnd ;
				}
				else if ( lineWidth < options.width ) {
					// This is the first line with an offset, so just start over in line two
					end = start ;
					return '' ;
				}

				currentLine = strArray.slice( start , end ).join( '' ) ;

				if ( options.fill ) {
					currentLine += ' '.repeat( lineWidth - lastWidth ) ;
				}

				return currentLine ;
			}

			// Do not move that inside the for(;;), some part are using a continue statement and manage the end value by themself
			end ++ ;
		}
	} ;

	while ( start < length && ( line = getNextLine() ) !== null ) {
		lines.push( line ) ;
		start = end ;
		lineWidth = options.width ;
	}

	// If it ends with an explicit newline, we have to reproduce it now!
	if ( explicitNewLine ) { lines.push( '' ) ; }

	if ( ! options.noTrim && ! options.fill ) {
		lines = lines.map( ( line_ , index ) => index === lines.length - 1 ? line_ : line_.trimRight() ) ;
	}

	if ( ! options.noJoin ) { lines = lines.join( options.glue ) ; }

	if ( options.updateOffset ) { options.offset = currentWidth ; }

	return lines ;
} ;



},{"./unicode.js":29}],31:[function(require,module,exports){
/*
	Tree Kit

	Copyright (c) 2014 - 2018 Cédric Ronvel

	The MIT License (MIT)

	Permission is hereby granted, free of charge, to any person obtaining a copy
	of this software and associated documentation files (the "Software"), to deal
	in the Software without restriction, including without limitation the rights
	to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
	copies of the Software, and to permit persons to whom the Software is
	furnished to do so, subject to the following conditions:

	The above copyright notice and this permission notice shall be included in all
	copies or substantial portions of the Software.

	THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
	IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
	FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
	AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
	LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
	OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
	SOFTWARE.
*/

"use strict" ;



/*
	Stand-alone fork of extend.js, without options.
*/

module.exports = function clone( originalObject , circular ) {
	// First create an empty object with
	// same prototype of our original source

	var propertyIndex , descriptor , keys , current , nextSource , indexOf ,
		copies = [ {
			source: originalObject ,
			target: Array.isArray( originalObject ) ? [] : Object.create( Object.getPrototypeOf( originalObject ) )
		} ] ,
		cloneObject = copies[ 0 ].target ,
		sourceReferences = [ originalObject ] ,
		targetReferences = [ cloneObject ] ;

	// First in, first out
	while ( ( current = copies.shift() ) ) {
		keys = Object.getOwnPropertyNames( current.source ) ;

		for ( propertyIndex = 0 ; propertyIndex < keys.length ; propertyIndex ++ ) {
			// Save the source's descriptor
			descriptor = Object.getOwnPropertyDescriptor( current.source , keys[ propertyIndex ] ) ;

			if ( ! descriptor.value || typeof descriptor.value !== 'object' ) {
				Object.defineProperty( current.target , keys[ propertyIndex ] , descriptor ) ;
				continue ;
			}

			nextSource = descriptor.value ;
			descriptor.value = Array.isArray( nextSource ) ? [] : Object.create( Object.getPrototypeOf( nextSource ) ) ;

			if ( circular ) {
				indexOf = sourceReferences.indexOf( nextSource ) ;

				if ( indexOf !== -1 ) {
					// The source is already referenced, just assign reference
					descriptor.value = targetReferences[ indexOf ] ;
					Object.defineProperty( current.target , keys[ propertyIndex ] , descriptor ) ;
					continue ;
				}

				sourceReferences.push( nextSource ) ;
				targetReferences.push( descriptor.value ) ;
			}

			Object.defineProperty( current.target , keys[ propertyIndex ] , descriptor ) ;

			copies.push( { source: nextSource , target: descriptor.value } ) ;
		}
	}

	return cloneObject ;
} ;

},{}],32:[function(require,module,exports){
/*
	Tree Kit

	Copyright (c) 2014 - 2018 Cédric Ronvel

	The MIT License (MIT)

	Permission is hereby granted, free of charge, to any person obtaining a copy
	of this software and associated documentation files (the "Software"), to deal
	in the Software without restriction, including without limitation the rights
	to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
	copies of the Software, and to permit persons to whom the Software is
	furnished to do so, subject to the following conditions:

	The above copyright notice and this permission notice shall be included in all
	copies or substantial portions of the Software.

	THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
	IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
	FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
	AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
	LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
	OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
	SOFTWARE.
*/

"use strict" ;



/*
	== Diff function ==
*/

function diff( left , right , options ) {
	var i , key , keyPath ,
		leftKeys , rightKeys , leftTypeof , rightTypeof ,
		depth , diffObject , length , arrayMode ;

	leftTypeof = typeof left ;
	rightTypeof = typeof right ;

	if (
		! left || ( leftTypeof !== 'object' && leftTypeof !== 'function' ) ||
		! right || ( rightTypeof !== 'object' && rightTypeof !== 'function' )
	) {
		throw new Error( '[tree] diff() needs objects as argument #0 and #1' ) ;
	}

	if ( ! options || typeof options !== 'object' ) { options = {} ; }

	depth = options.depth || 0 ;

	// Things applied only for the root, not for recursive call
	if ( ! depth ) {
		options.diffObject = {} ;
		if ( ! options.path ) { options.path = '' ; }
		if ( ! options.pathSeparator ) { options.pathSeparator = '.' ; }
	}

	diffObject = options.diffObject ;


	// Left part
	if ( Array.isArray( left ) ) {
		arrayMode = true ;
		length = left.length ;
	}
	else {
		arrayMode = false ;
		leftKeys = Object.keys( left ) ;
		length = leftKeys.length ;
	}

	for ( i = 0 ; i < length ; i ++ ) {
		key = arrayMode ? i : leftKeys[ i ] ;
		keyPath = options.path + options.pathSeparator + key ;
		//console.log( 'L keyPath:' , keyPath ) ;

		if ( ! right.hasOwnProperty( key ) ) {
			diffObject[ keyPath ] = { path: keyPath , message: 'does not exist in right-hand side' } ;
			continue ;
		}

		leftTypeof = typeof left[ key ] ;
		rightTypeof = typeof right[ key ] ;

		if ( leftTypeof !== rightTypeof ) {
			diffObject[ keyPath ] = { path: keyPath , message: 'different typeof: ' + leftTypeof + ' - ' + rightTypeof } ;
			continue ;
		}

		if ( leftTypeof === 'object' || leftTypeof === 'function' ) {
			// Cleanup the 'null is an object' mess
			if ( ! left[ key ] ) {
				if ( right[ key ] ) { diffObject[ keyPath ] = { path: keyPath , message: 'different type: null - Object' } ; }
				continue ;
			}

			if ( ! right[ key ] ) {
				diffObject[ keyPath ] = { path: keyPath , message: 'different type: Object - null' } ;
				continue ;
			}

			if ( Array.isArray( left[ key ] ) && ! Array.isArray( right[ key ] ) ) {
				diffObject[ keyPath ] = { path: keyPath , message: 'different type: Array - Object' } ;
				continue ;
			}

			if ( ! Array.isArray( left[ key ] ) && Array.isArray( right[ key ] ) ) {
				diffObject[ keyPath ] = { path: keyPath , message: 'different type: Object - Array' } ;
				continue ;
			}

			diff( left[ key ] , right[ key ] , {
				path: keyPath , pathSeparator: options.pathSeparator , depth: depth + 1 , diffObject: diffObject
			} ) ;
			continue ;
		}

		if ( left[ key ] !== right[ key ] ) {
			diffObject[ keyPath ] = { path: keyPath , message: 'different value: ' + left[ key ] + ' - ' + right[ key ] } ;
			continue ;
		}
	}


	// Right part
	if ( Array.isArray( right ) ) {
		arrayMode = true ;
		length = right.length ;
	}
	else {
		arrayMode = false ;
		rightKeys = Object.keys( right ) ;
		length = rightKeys.length ;
	}

	for ( i = 0 ; i < length ; i ++ ) {
		key = arrayMode ? i : rightKeys[ i ] ;
		keyPath = options.path + options.pathSeparator + key ;
		//console.log( 'R keyPath:' , keyPath ) ;

		if ( ! left.hasOwnProperty( key ) ) {
			diffObject[ keyPath ] = { path: keyPath , message: 'does not exist in left-hand side' } ;
			continue ;
		}
	}

	return Object.keys( diffObject ).length ? diffObject : null ;
}

exports.diff = diff ;


},{}],33:[function(require,module,exports){
/*
	Tree Kit

	Copyright (c) 2014 - 2018 Cédric Ronvel

	The MIT License (MIT)

	Permission is hereby granted, free of charge, to any person obtaining a copy
	of this software and associated documentation files (the "Software"), to deal
	in the Software without restriction, including without limitation the rights
	to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
	copies of the Software, and to permit persons to whom the Software is
	furnished to do so, subject to the following conditions:

	The above copyright notice and this permission notice shall be included in all
	copies or substantial portions of the Software.

	THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
	IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
	FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
	AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
	LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
	OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
	SOFTWARE.
*/

"use strict" ;



const dotPath = {} ;
module.exports = dotPath ;



const EMPTY_PATH = [] ;

function toPathArray( path ) {
	if ( Array.isArray( path ) ) {
		return path ;
	}
	else if ( ! path ) {
		return EMPTY_PATH ;
	}
	else if ( typeof path === 'string' ) {
		return path.split( '.' ) ;
	}

	throw new TypeError( '[tree.dotPath]: the path argument should be a string or an array' ) ;
}



// Walk the tree using the path array.
function walk( object , pathArray ) {
	var i , iMax ,
		pointer = object ;

	for ( i = 0 , iMax = pathArray.length ; i < iMax ; i ++ ) {
		if ( ! pointer || ( typeof pointer !== 'object' && typeof pointer !== 'function' ) ) {
			return undefined ;
		}

		pointer = pointer[ pathArray[ i ] ] ;
	}

	return pointer ;
}



// Walk the tree, stop before the last path part.
function walkBeforeLast( object , pathArray ) {
	var i , iMax ,
		pointer = object ;

	for ( i = 0 , iMax = pathArray.length - 1 ; i < iMax ; i ++ ) {
		if ( ! pointer || ( typeof pointer !== 'object' && typeof pointer !== 'function' ) ) {
			return undefined ;
		}

		pointer = pointer[ pathArray[ i ] ] ;
	}

	return pointer ;
}



// Walk the tree, create missing element: pave the path up to before the last part of the path.
// Return that before-the-last element.
// Object MUST be an object! no check are performed for the first step!
function pave( object , pathArray ) {
	var i , iMax ,
		key ,
		pointer = object ;

	for ( i = 0 , iMax = pathArray.length - 1 ; i < iMax ; i ++ ) {
		key = pathArray[ i ] ;

		if ( ! pointer[ key ] || ( typeof pointer[ key ] !== 'object' && typeof pointer[ key ] !== 'function' ) ) {
			pointer[ key ] = {} ;
		}

		pointer = pointer[ key ] ;
	}

	return pointer ;
}



dotPath.get = function( object , path ) {
	return walk( object , toPathArray( path ) ) ;
} ;



dotPath.set = function( object , path , value ) {
	if ( ! object || ( typeof object !== 'object' && typeof object !== 'function' ) ) {
		// Throw?
		return undefined ;
	}

	var pathArray = toPathArray( path ) ;
	var pointer = pave( object , pathArray ) ;

	pointer[ pathArray[ pathArray.length - 1 ] ] = value ;

	return value ;
} ;



dotPath.define = function( object , path , value ) {
	if ( ! object || ( typeof object !== 'object' && typeof object !== 'function' ) ) {
		// Throw?
		return undefined ;
	}

	var pathArray = toPathArray( path ) ;
	var pointer = pave( object , pathArray ) ;
	var key = pathArray[ pathArray.length - 1 ] ;

	if ( ! ( key in pointer ) ) { pointer[ key ] = value ; }

	return value ;
} ;



dotPath.inc = function( object , path , value ) {
	if ( ! object || ( typeof object !== 'object' && typeof object !== 'function' ) ) {
		// Throw?
		return undefined ;
	}

	var pathArray = toPathArray( path ) ;
	var pointer = pave( object , pathArray ) ;
	var key = pathArray[ pathArray.length - 1 ] ;

	if ( typeof pointer[ key ] === 'number' ) { pointer[ key ] ++ ; }
	else if ( ! pointer[ key ] || typeof pointer[ key ] !== 'object' ) { pointer[ key ] = 1 ; }

	return value ;
} ;



dotPath.dec = function( object , path , value ) {
	if ( ! object || ( typeof object !== 'object' && typeof object !== 'function' ) ) {
		// Throw?
		return undefined ;
	}

	var pathArray = toPathArray( path ) ;
	var pointer = pave( object , pathArray ) ;
	var key = pathArray[ pathArray.length - 1 ] ;

	if ( typeof pointer[ key ] === 'number' ) { pointer[ key ] -- ; }
	else if ( ! pointer[ key ] || typeof pointer[ key ] !== 'object' ) { pointer[ key ] = -1 ; }

	return value ;
} ;



dotPath.concat = function( object , path , value ) {
	if ( ! object || ( typeof object !== 'object' && typeof object !== 'function' ) ) {
		// Throw?
		return undefined ;
	}

	var pathArray = toPathArray( path ) ;
	var pointer = pave( object , pathArray ) ;
	var key = pathArray[ pathArray.length - 1 ] ;

	if ( ! pointer[ key ] ) { pointer[ key ] = value ; }
	else if ( Array.isArray( pointer[ key ] ) && Array.isArray( value ) ) {
		pointer[ key ] = pointer[ key ].concat( value ) ;
	}
	//else ? do nothing???

	return value ;
} ;



dotPath.insert = function( object , path , value ) {
	if ( ! object || ( typeof object !== 'object' && typeof object !== 'function' ) ) {
		// Throw?
		return undefined ;
	}

	var pathArray = toPathArray( path ) ;
	var pointer = pave( object , pathArray ) ;
	var key = pathArray[ pathArray.length - 1 ] ;

	if ( ! pointer[ key ] ) { pointer[ key ] = value ; }
	else if ( Array.isArray( pointer[ key ] ) && Array.isArray( value ) ) {
		pointer[ key ] = value.concat( pointer[ key ] ) ;
	}
	//else ? do nothing???

	return value ;
} ;



dotPath.delete = function( object , path ) {
	var pathArray = toPathArray( path ) ;
	var pointer = walkBeforeLast( object , pathArray ) ;

	if ( ! pointer || ( typeof pointer !== 'object' && typeof pointer !== 'function' ) ) {
		return false ;
	}

	return delete pointer[ pathArray[ pathArray.length - 1 ] ] ;
} ;



dotPath.autoPush = function( object , path , value ) {
	if ( ! object || ( typeof object !== 'object' && typeof object !== 'function' ) ) {
		// Throw?
		return undefined ;
	}

	var pathArray = toPathArray( path ) ;
	var pointer = pave( object , pathArray ) ;

	var key = pathArray[ pathArray.length - 1 ] ;

	if ( pointer[ key ] === undefined ) { pointer[ key ] = value ; }
	else if ( Array.isArray( pointer[ key ] ) ) { pointer[ key ].push( value ) ; }
	else { pointer[ key ] = [ pointer[ key ] , value ] ; }

	return pointer[ key ] ;
} ;



dotPath.append = function( object , path , value ) {
	if ( ! object || ( typeof object !== 'object' && typeof object !== 'function' ) ) {
		// Throw?
		return undefined ;
	}

	var pathArray = toPathArray( path ) ;
	var pointer = pave( object , pathArray ) ;

	var key = pathArray[ pathArray.length - 1 ] ;

	if ( ! pointer[ key ] ) { pointer[ key ] = [ value ] ; }
	else if ( Array.isArray( pointer[ key ] ) ) { pointer[ key ].push( value ) ; }
	//else ? do nothing???

	return pointer[ key ] ;
} ;



dotPath.prepend = function( object , path , value ) {
	if ( ! object || ( typeof object !== 'object' && typeof object !== 'function' ) ) {
		// Throw?
		return undefined ;
	}

	var pathArray = toPathArray( path ) ;
	var pointer = pave( object , pathArray ) ;

	var key = pathArray[ pathArray.length - 1 ] ;

	if ( ! pointer[ key ] ) { pointer[ key ] = [ value ] ; }
	else if ( Array.isArray( pointer[ key ] ) ) { pointer[ key ].unshift( value ) ; }
	//else ? do nothing???

	return pointer[ key ] ;
} ;


},{}],34:[function(require,module,exports){
/*
	Tree Kit

	Copyright (c) 2014 - 2018 Cédric Ronvel

	The MIT License (MIT)

	Permission is hereby granted, free of charge, to any person obtaining a copy
	of this software and associated documentation files (the "Software"), to deal
	in the Software without restriction, including without limitation the rights
	to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
	copies of the Software, and to permit persons to whom the Software is
	furnished to do so, subject to the following conditions:

	The above copyright notice and this permission notice shall be included in all
	copies or substantial portions of the Software.

	THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
	IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
	FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
	AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
	LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
	OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
	SOFTWARE.
*/

"use strict" ;



/*
	== Extend function ==
*/

/*
	options:
		* own: only copy own properties that are enumerable
		* nonEnum: copy non-enumerable properties as well, works only with own:true
		* descriptor: preserve property's descriptor
		* deep: boolean/Array/Set, if true perform a deep (recursive) extend, if it is an Array/Set of prototypes, only deep-copy
			objects of those prototypes
			(it is a replacement for deepFilter.whitelist which was removed in Tree Kit 0.6).
		* immutables: an Array/Set of immutable object's prototypes that are filtered out for deep-copy
			(it is a replacement for deepFilter.blacklist which was removed in Tree Kit 0.6).
		* maxDepth: used in conjunction with deep, when max depth is reached an exception is raised, default to 100 when
			the 'circular' option is off, or default to null if 'circular' is on
		* circular: circular references reconnection
		* move: move properties to target (delete properties from the sources)
		* preserve: existing properties in the target object are not overwritten
		* nofunc: skip functions
		* deepFunc: in conjunction with 'deep', this will process sources functions like objects rather than
			copying/referencing them directly into the source, thus, the result will not be a function, it forces 'deep'
		* proto: try to clone objects with the right prototype, using Object.create() or mutating it with Object.setPrototypeOf(),
			it forces option 'own'.
		* inherit: rather than mutating target prototype for source prototype like the 'proto' option does, here it is
			the source itself that IS the prototype for the target. Force option 'own' and disable 'proto'.
		* skipRoot: the prototype of the target root object is NOT mutated only if this option is set.
		* flat: extend into the target top-level only, compose name with the path of the source, force 'deep',
			disable 'unflat', 'proto', 'inherit'
		* unflat: assume sources are in the 'flat' format, expand all properties deeply into the target, disable 'flat'
*/
function extend( options , target , ... sources ) {
	//console.log( "\nextend():\n" , arguments ) ;
	var i , source , newTarget = false , length = sources.length ;

	if ( ! length ) { return target ; }

	if ( ! options || typeof options !== 'object' ) { options = {} ; }

	var runtime = { depth: 0 , prefix: '' } ;

	if ( options.deep ) {
		if ( Array.isArray( options.deep ) ) { options.deep = new Set( options.deep ) ; }
		else if ( ! ( options.deep instanceof Set ) ) { options.deep = true ; }
	}

	if ( options.immutables ) {
		if ( Array.isArray( options.immutables ) ) { options.immutables = new Set( options.immutables ) ; }
		else if ( ! ( options.immutables instanceof Set ) ) { delete options.immutables ; }
	}

	if ( ! options.maxDepth && options.deep && ! options.circular ) { options.maxDepth = 100 ; }

	if ( options.deepFunc ) { options.deep = true ; }

	// 'flat' option force 'deep'
	if ( options.flat ) {
		options.deep = true ;
		options.proto = false ;
		options.inherit = false ;
		options.unflat = false ;
		if ( typeof options.flat !== 'string' ) { options.flat = '.' ; }
	}

	if ( options.unflat ) {
		options.deep = false ;
		options.proto = false ;
		options.inherit = false ;
		options.flat = false ;
		if ( typeof options.unflat !== 'string' ) { options.unflat = '.' ; }
	}

	// If the prototype is applied, only owned properties should be copied
	if ( options.inherit ) { options.own = true ; options.proto = false ; }
	else if ( options.proto ) { options.own = true ; }

	if ( ! target || ( typeof target !== 'object' && typeof target !== 'function' ) ) {
		newTarget = true ;
	}

	if ( ! options.skipRoot && ( options.inherit || options.proto ) ) {
		for ( i = length - 1 ; i >= 0 ; i -- ) {
			source = sources[ i ] ;
			if ( source && ( typeof source === 'object' || typeof source === 'function' ) ) {
				if ( options.inherit ) {
					if ( newTarget ) { target = Object.create( source ) ; }
					else { Object.setPrototypeOf( target , source ) ; }
				}
				else if ( options.proto ) {
					if ( newTarget ) { target = Object.create( Object.getPrototypeOf( source ) ) ; }
					else { Object.setPrototypeOf( target , Object.getPrototypeOf( source ) ) ; }
				}

				break ;
			}
		}
	}
	else if ( newTarget ) {
		target = {} ;
	}

	runtime.references = { sources: [] , targets: [] } ;

	for ( i = 0 ; i < length ; i ++ ) {
		source = sources[ i ] ;
		if ( ! source || ( typeof source !== 'object' && typeof source !== 'function' ) ) { continue ; }
		extendOne( runtime , options , target , source ) ;
	}

	return target ;
}

module.exports = extend ;



function extendOne( runtime , options , target , source ) {
	//console.log( "\nextendOne():\n" , arguments ) ;
	//process.exit() ;

	var j , jmax , sourceKeys , sourceKey , sourceValue , sourceValueProto ,
		value , sourceDescriptor , targetKey , targetPointer , path ,
		indexOfSource = -1 ;

	// Max depth check
	if ( options.maxDepth && runtime.depth > options.maxDepth ) {
		throw new Error( '[tree] extend(): max depth reached(' + options.maxDepth + ')' ) ;
	}


	if ( options.circular ) {
		runtime.references.sources.push( source ) ;
		runtime.references.targets.push( target ) ;
	}

	if ( options.own ) {
		if ( options.nonEnum ) { sourceKeys = Object.getOwnPropertyNames( source ) ; }
		else { sourceKeys = Object.keys( source ) ; }
	}
	else { sourceKeys = source ; }

	for ( sourceKey in sourceKeys ) {
		if ( options.own ) { sourceKey = sourceKeys[ sourceKey ] ; }

		// OMG, this DEPRECATED __proto__ shit is still alive and can be used to hack anything ><
		if ( sourceKey === '__proto__' ) { continue ; }

		// If descriptor is on, get it now
		if ( options.descriptor ) {
			sourceDescriptor = Object.getOwnPropertyDescriptor( source , sourceKey ) ;
			sourceValue = sourceDescriptor.value ;
		}
		else {
			// We have to trigger an eventual getter only once
			sourceValue = source[ sourceKey ] ;
		}

		targetPointer = target ;
		targetKey = runtime.prefix + sourceKey ;

		// Do not copy if property is a function and we don't want them
		if ( options.nofunc && typeof sourceValue === 'function' ) { continue ; }

		// 'unflat' mode computing
		if ( options.unflat && runtime.depth === 0 ) {
			path = sourceKey.split( options.unflat ) ;
			jmax = path.length - 1 ;

			if ( jmax ) {
				for ( j = 0 ; j < jmax ; j ++ ) {
					if ( ! targetPointer[ path[ j ] ] ||
						( typeof targetPointer[ path[ j ] ] !== 'object' &&
							typeof targetPointer[ path[ j ] ] !== 'function' ) ) {
						targetPointer[ path[ j ] ] = {} ;
					}

					targetPointer = targetPointer[ path[ j ] ] ;
				}

				targetKey = runtime.prefix + path[ jmax ] ;
			}
		}


		if ( options.deep	// eslint-disable-line no-constant-condition
			&& sourceValue
			&& ( typeof sourceValue === 'object' || ( options.deepFunc && typeof sourceValue === 'function' ) )
			&& ( ! options.descriptor || ! sourceDescriptor.get )
			// not a condition we just cache sourceValueProto now... ok it's trashy ><
			&& ( ( sourceValueProto = Object.getPrototypeOf( sourceValue ) ) || true )
			&& ( ! ( options.deep instanceof Set ) || options.deep.has( sourceValueProto ) )
			&& ( ! options.immutables || ! options.immutables.has( sourceValueProto ) )
		) {
			if ( options.circular ) {
				indexOfSource = runtime.references.sources.indexOf( sourceValue ) ;
			}

			if ( options.flat ) {
				// No circular references reconnection when in 'flat' mode
				if ( indexOfSource >= 0 ) { continue ; }

				extendOne(
					{ depth: runtime.depth + 1 , prefix: runtime.prefix + sourceKey + options.flat , references: runtime.references } ,
					options , targetPointer , sourceValue
				) ;
			}
			else {
				if ( indexOfSource >= 0 ) {
					// Circular references reconnection...
					if ( options.descriptor ) {
						Object.defineProperty( targetPointer , targetKey , {
							value: runtime.references.targets[ indexOfSource ] ,
							enumerable: sourceDescriptor.enumerable ,
							writable: sourceDescriptor.writable ,
							configurable: sourceDescriptor.configurable
						} ) ;
					}
					else {
						targetPointer[ targetKey ] = runtime.references.targets[ indexOfSource ] ;
					}

					continue ;
				}

				if ( ! targetPointer[ targetKey ] || ! targetPointer.hasOwnProperty( targetKey ) || ( typeof targetPointer[ targetKey ] !== 'object' && typeof targetPointer[ targetKey ] !== 'function' ) ) {
					if ( Array.isArray( sourceValue ) ) { value = [] ; }
					else if ( options.proto ) { value = Object.create( sourceValueProto ) ; }	// jshint ignore:line
					else if ( options.inherit ) { value = Object.create( sourceValue ) ; }
					else { value = {} ; }

					if ( options.descriptor ) {
						Object.defineProperty( targetPointer , targetKey , {
							value: value ,
							enumerable: sourceDescriptor.enumerable ,
							writable: sourceDescriptor.writable ,
							configurable: sourceDescriptor.configurable
						} ) ;
					}
					else {
						targetPointer[ targetKey ] = value ;
					}
				}
				else if ( options.proto && Object.getPrototypeOf( targetPointer[ targetKey ] ) !== sourceValueProto ) {
					Object.setPrototypeOf( targetPointer[ targetKey ] , sourceValueProto ) ;
				}
				else if ( options.inherit && Object.getPrototypeOf( targetPointer[ targetKey ] ) !== sourceValue ) {
					Object.setPrototypeOf( targetPointer[ targetKey ] , sourceValue ) ;
				}

				if ( options.circular ) {
					runtime.references.sources.push( sourceValue ) ;
					runtime.references.targets.push( targetPointer[ targetKey ] ) ;
				}

				// Recursively extends sub-object
				extendOne(
					{ depth: runtime.depth + 1 , prefix: '' , references: runtime.references } ,
					options , targetPointer[ targetKey ] , sourceValue
				) ;
			}
		}
		else if ( options.preserve && targetPointer[ targetKey ] !== undefined ) {
			// Do not overwrite, and so do not delete source's properties that were not moved
			continue ;
		}
		else if ( ! options.inherit ) {
			if ( options.descriptor ) { Object.defineProperty( targetPointer , targetKey , sourceDescriptor ) ; }
			else { targetPointer[ targetKey ] = sourceValue ; }
		}

		// Delete owned property of the source object
		if ( options.move ) { delete source[ sourceKey ] ; }
	}
}


},{}],35:[function(require,module,exports){
/*
	Tree Kit

	Copyright (c) 2014 - 2018 Cédric Ronvel

	The MIT License (MIT)

	Permission is hereby granted, free of charge, to any person obtaining a copy
	of this software and associated documentation files (the "Software"), to deal
	in the Software without restriction, including without limitation the rights
	to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
	copies of the Software, and to permit persons to whom the Software is
	furnished to do so, subject to the following conditions:

	The above copyright notice and this permission notice shall be included in all
	copies or substantial portions of the Software.

	THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
	IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
	FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
	AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
	LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
	OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
	SOFTWARE.
*/

"use strict" ;



/*
	DEPRECATED, moved to its own module: lazyness
*/

exports.defineLazyProperty = function defineLazyProperty( object , name , func ) {
	Object.defineProperty( object , name , {
		configurable: true ,
		enumerable: true ,
		get: function() {

			var value = func() ;

			Object.defineProperty( object , name , {
				configurable: true ,
				enumerable: true ,
				writable: false ,
				value: value
			} ) ;

			return value ;
		}
	} ) ;
} ;

},{}],36:[function(require,module,exports){
/*
	Tree Kit

	Copyright (c) 2014 - 2018 Cédric Ronvel

	The MIT License (MIT)

	Permission is hereby granted, free of charge, to any person obtaining a copy
	of this software and associated documentation files (the "Software"), to deal
	in the Software without restriction, including without limitation the rights
	to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
	copies of the Software, and to permit persons to whom the Software is
	furnished to do so, subject to the following conditions:

	The above copyright notice and this permission notice shall be included in all
	copies or substantial portions of the Software.

	THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
	IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
	FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
	AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
	LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
	OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
	SOFTWARE.
*/

"use strict" ;



// Load modules
var tree = require( './tree.js' ) ;
var util = require( 'util' ) ;



// Create and export
var masklib = {} ;
module.exports = masklib ;



/*
	== Mask-family class ==

	Recursively select values in the input object if the same path in the mask object is set.
*/

/*
	TODO:
	- negative mask
	- constraint check
	- Maskable object, like in csk-php
*/

masklib.Mask = function Mask() {
	throw new Error( 'Cannot create a tree.Mask() directly' ) ;
} ;



var maskDefaultOptions = {
	clone: false ,
	path: '<object>' ,
	pathSeparator: '.'
} ;



/*
	options:
		clone: the output clone the input rather than reference it
		pathSeperator: when expressing path, this is the separator
		leaf: a callback to exec for each mask leaf
		node? a callback to exec for each mask node
*/
masklib.createMask = function createMask( maskArgument , options ) {
	if ( maskArgument === null || typeof maskArgument !== 'object' ) {
		throw new TypeError( '[tree] .createMask() : Argument #1 should be an object' ) ;
	}

	if ( options !== null && typeof options === 'object' ) { options = tree.extend( null , {} , maskDefaultOptions , options ) ; }
	else { options = maskDefaultOptions ; }

	var mask = Object.create( masklib.Mask.prototype , {
		__options__: { value: options , writable: true  }
	} ) ;

	tree.extend( null , mask , maskArgument ) ;

	return mask ;
} ;



// Apply the mask to an input tree
masklib.Mask.prototype.applyTo = function applyTo( input , context , contextOverideDefault ) {
	// Arguments checking
	if ( input === null || typeof input !== 'object' ) {
		throw new TypeError( '[tree] .applyTo() : Argument #1 should be an object' ) ;
	}

	if ( contextOverideDefault ) {
		context = tree.extend( null ,
			{
				mask: this ,
				options: this.__options__ ,
				path: this.__options__.path
			} ,
			context
		) ;
	}
	else if ( context === undefined ) {
		context = {
			mask: this ,
			options: this.__options__ ,
			path: this.__options__.path
		} ;
	}


	// Init
	//console.log( context ) ;
	var result , nextPath , output ,
		i , key , maskValue ,
		maskKeyList = Object.keys( context.mask ) ,
		j , inputKey , inputValue , inputKeyList ;

	if ( Array.isArray( input ) ) { output = [] ; }
	else { output = {} ; }


	// Iterate through mask properties
	for ( i = 0 ; i < maskKeyList.length ; i ++ ) {
		key = maskKeyList[ i ] ;
		maskValue = context.mask[ key ] ;

		//console.log( '\nnext loop: ' , key , maskValue ) ;

		// The special key * is a wildcard, it match everything
		if ( key === '*' ) {
			//console.log( 'wildcard' ) ;
			inputKeyList = Object.keys( input ) ;

			for ( j = 0 ; j < inputKeyList.length ; j ++ ) {
				inputKey = inputKeyList[ j ] ;
				inputValue = input[ inputKey ] ;

				//console.log( '*: ' , inputKey ) ;
				nextPath = context.path + context.options.pathSeparator + inputKey ;

				// If it is an array or object, recursively check it
				if ( maskValue !== null && typeof maskValue === 'object' ) {
					if ( inputValue !== null && typeof inputValue === 'object' ) {
						if ( inputValue instanceof masklib.Mask ) {
							output[ inputKey ] = inputValue.applyTo( inputValue , { path: nextPath } , true ) ;
						}
						else {
							output[ inputKey ] = this.applyTo( inputValue , tree.extend( null , {} , context , { mask: maskValue , path: nextPath } ) ) ;
						}
					}
					else if ( typeof context.options.leaf === 'function' ) {
						output[ inputKey ] = this.applyTo( {} , tree.extend( null , {} , context , { mask: maskValue , path: nextPath } ) ) ;
					}
				}
				else if ( maskValue !== null && typeof context.options.leaf === 'function' ) {
					//console.log( 'leaf callback' ) ;
					result = context.options.leaf( input , inputKey , maskValue , nextPath ) ;
					if ( ! ( result instanceof Error ) ) { output[ inputKey ] = result ; }
				}
				else if ( context.options.clone && ( inputValue !== null && typeof inputValue === 'object' ) ) {
					output[ inputKey ] = tree.extend( { deep: true } , {} , inputValue ) ;
				}
				else {
					output[ inputKey ] = inputValue ;
				}
			}

			continue ;
		}


		nextPath = context.path + context.options.pathSeparator + key ;

		// If it is an object, recursively check it
		//if ( maskValue instanceof masklib.Mask )
		if ( maskValue !== null && typeof maskValue === 'object' ) {
			//console.log( 'sub' ) ;

			if ( input.hasOwnProperty( key ) && input[ key ] !== null && typeof input[ key ] === 'object' ) {
				//console.log( 'recursive call' ) ;

				if ( input.key instanceof masklib.Mask ) {
					output[ key ] = input.key.applyTo( input[ key ] , { path: nextPath } , true ) ;
				}
				else {
					output[ key ] = this.applyTo( input[ key ] , tree.extend( null , {} , context , { mask: maskValue , path: nextPath } ) ) ;
				}
			}
			// recursive call only if there are callback
			else if ( context.options.leaf ) {
				//console.log( 'recursive call' ) ;
				output[ key ] = this.applyTo( {} , tree.extend( null , {} , context , { mask: maskValue , path: nextPath } ) ) ;
			}
		}
		// If mask exists, add the key
		else if ( input.hasOwnProperty( key ) ) {
			//console.log( 'property found' ) ;

			if ( maskValue !== undefined && typeof context.options.leaf === 'function' ) {
				//console.log( 'leaf callback' ) ;
				result = context.options.leaf( input , key , maskValue , nextPath ) ;
				if ( ! ( result instanceof Error ) ) { output[ key ] = result ; }
			}
			else if ( context.options.clone && ( input[ key ] !== null && typeof input[ key ] === 'object' ) ) {
				output[ key ] = tree.extend( { deep: true } , {} , input[ key ] ) ;
			}
			else {
				output[ key ] = input[ key ] ;
			}
		}
		else if ( maskValue !== undefined && typeof context.options.leaf === 'function' ) {
			//console.log( 'leaf callback' ) ;
			result = context.options.leaf( input , key , maskValue , nextPath ) ;
			if ( ! ( result instanceof Error ) ) { output[ key ] = result ; }
		}
	}

	return output ;
} ;



// InverseMask: create an output tree from the input, by excluding properties of the mask

masklib.InverseMask = function InverseMask() {
	throw new Error( 'Cannot create a tree.InverseMask() directly' ) ;
} ;

util.inherits( masklib.InverseMask , masklib.Mask ) ;



/*
	options:
		clone: the output clone the input rather than reference it
		pathSeperator: when expressing path, this is the separator
*/
masklib.createInverseMask = function createInverseMask( maskArgument , options ) {
	if ( maskArgument === null || typeof maskArgument !== 'object' ) {
		throw new TypeError( '[tree] .createInverseMask() : Argument #1 should be an object' ) ;
	}

	if ( options !== null && typeof options === 'object' ) { options = tree.extend( null , {} , maskDefaultOptions , options ) ; }
	else { options = maskDefaultOptions ; }

	var mask = Object.create( masklib.InverseMask.prototype , {
		__options__: { value: options , writable: true  }
	} ) ;

	tree.extend( null , mask , maskArgument ) ;

	return mask ;
} ;



// Apply the mask to an input tree
masklib.InverseMask.prototype.applyTo = function applyTo( input , context , contextOverideDefault ) {
	// Arguments checking
	if ( input === null || typeof input !== 'object' ) {
		throw new TypeError( '[tree] .applyTo() : Argument #1 should be an object' ) ;
	}

	if ( contextOverideDefault ) {
		context = tree.extend( null ,
			{
				mask: this ,
				options: this.__options__ ,
				path: this.__options__.path
			} ,
			context
		) ;
	}
	else if ( context === undefined ) {
		context = {
			mask: this ,
			options: this.__options__ ,
			path: this.__options__.path
		} ;
	}


	// Init
	//console.log( context ) ;
	var nextPath , output ,
		i , key , maskValue ,
		maskKeyList = Object.keys( context.mask ) ,
		j , inputKey , inputValue , inputKeyList ;

	if ( Array.isArray( input ) ) { output = tree.extend( { deep: true } , [] , input ) ; }
	else { output = tree.extend( { deep: true } , {} , input ) ; }

	//console.log( output ) ;

	// Iterate through mask properties
	for ( i = 0 ; i < maskKeyList.length ; i ++ ) {
		key = maskKeyList[ i ] ;
		maskValue = context.mask[ key ] ;

		//console.log( '\nnext loop: ' , key , maskValue ) ;

		// The special key * is a wildcard, it match everything
		if ( key === '*' ) {
			//console.log( 'wildcard' ) ;
			inputKeyList = Object.keys( input ) ;

			for ( j = 0 ; j < inputKeyList.length ; j ++ ) {
				inputKey = inputKeyList[ j ] ;
				inputValue = input[ inputKey ] ;

				//console.log( '*: ' , inputKey ) ;
				nextPath = context.path + context.options.pathSeparator + inputKey ;

				// If it is an array or object, recursively check it
				if ( maskValue !== null && typeof maskValue === 'object' ) {
					if ( inputValue !== null && typeof inputValue === 'object' ) {
						if ( inputValue instanceof masklib.Mask ) {
							output[ inputKey ] = inputValue.applyTo( inputValue , { path: nextPath } , true ) ;
						}
						else {
							output[ inputKey ] = this.applyTo( inputValue , tree.extend( null , {} , context , { mask: maskValue , path: nextPath } ) ) ;
						}
					}
				}
				else {
					delete output[ inputKey ] ;
				}
			}

			continue ;
		}


		nextPath = context.path + context.options.pathSeparator + key ;

		// If it is an object, recursively check it
		//if ( maskValue instanceof masklib.Mask )
		if ( maskValue !== null && typeof maskValue === 'object' ) {
			//console.log( 'sub' ) ;

			if ( input.hasOwnProperty( key ) && input[ key ] !== null && typeof input[ key ] === 'object' ) {
				//console.log( 'recursive call' ) ;

				if ( input.key instanceof masklib.Mask ) {
					output[ key ] = input.key.applyTo( input[ key ] , { path: nextPath } , true ) ;
				}
				else {
					output[ key ] = this.applyTo( input[ key ] , tree.extend( null , {} , context , { mask: maskValue , path: nextPath } ) ) ;
				}
			}
		}
		// If mask exists, remove the key
		else if ( input.hasOwnProperty( key ) ) {
			delete output[ key ] ;
		}
	}

	return output ;
} ;

},{"./tree.js":38,"util":49}],37:[function(require,module,exports){
/*
	Tree Kit

	Copyright (c) 2014 - 2018 Cédric Ronvel

	The MIT License (MIT)

	Permission is hereby granted, free of charge, to any person obtaining a copy
	of this software and associated documentation files (the "Software"), to deal
	in the Software without restriction, including without limitation the rights
	to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
	copies of the Software, and to permit persons to whom the Software is
	furnished to do so, subject to the following conditions:

	The above copyright notice and this permission notice shall be included in all
	copies or substantial portions of the Software.

	THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
	IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
	FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
	AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
	LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
	OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
	SOFTWARE.
*/

"use strict" ;



var treePath = {} ;
module.exports = treePath ;



treePath.op = function op( type , object , path , value ) {
	var i , parts , last , pointer , key , isArray = false , pathArrayMode = false , isGenericSet , canBeEmpty = true ;

	if ( ! object || ( typeof object !== 'object' && typeof object !== 'function' ) ) {
		return ;
	}

	if ( typeof path === 'string' ) {
		// Split the path into parts
		if ( path ) { parts = path.match( /([.#[\]]|[^.#[\]]+)/g ) ; }
		else { parts = [ '' ] ; }

		if ( parts[ 0 ] === '.' ) { parts.unshift( '' ) ; }
		if ( parts[ parts.length - 1 ] === '.' ) { parts.push( '' ) ; }
	}
	else if ( Array.isArray( path ) ) {
		parts = path ;
		pathArrayMode = true ;
	}
	else {
		throw new TypeError( '[tree.path] .' + type + '(): the path argument should be a string or an array' ) ;
	}

	switch ( type ) {
		case 'get' :
		case 'delete' :
			isGenericSet = false ;
			break ;
		case 'set' :
		case 'define' :
		case 'inc' :
		case 'dec' :
		case 'append' :
		case 'prepend' :
		case 'concat' :
		case 'insert' :
		case 'autoPush' :
			isGenericSet = true ;
			break ;
		default :
			throw new TypeError( "[tree.path] .op(): wrong type of operation '" + type + "'" ) ;
	}

	//console.log( parts ) ;
	// The pointer start at the object's root
	pointer = object ;

	last = parts.length - 1 ;

	for ( i = 0 ; i <= last ; i ++ ) {
		if ( pathArrayMode ) {
			if ( key === undefined ) {
				key = parts[ i ] ;
				continue ;
			}

			if ( ! pointer[ key ] || ( typeof pointer[ key ] !== 'object' && typeof pointer[ key ] !== 'function' ) ) {
				if ( ! isGenericSet ) { return undefined ; }
				pointer[ key ] = {} ;
			}

			pointer = pointer[ key ] ;
			key = parts[ i ] ;

			continue ;
		}
		else if ( parts[ i ] === '.' ) {
			isArray = false ;

			if ( key === undefined ) {
				if ( ! canBeEmpty ) {
					canBeEmpty = true ;
					continue ;
				}

				key = '' ;
			}

			if ( ! pointer[ key ] || ( typeof pointer[ key ] !== 'object' && typeof pointer[ key ] !== 'function' ) ) {
				if ( ! isGenericSet ) { return undefined ; }
				pointer[ key ] = {} ;
			}

			pointer = pointer[ key ] ;
			canBeEmpty = true ;

			continue ;
		}
		else if ( parts[ i ] === '#' || parts[ i ] === '[' ) {
			isArray = true ;
			canBeEmpty = false ;

			if ( key === undefined ) {
				// The root element cannot be altered, we are in trouble if an array is expected but we have only a regular object.
				if ( ! Array.isArray( pointer ) ) { return undefined ; }
				continue ;
			}

			if ( ! pointer[ key ] || ! Array.isArray( pointer[ key ] ) ) {
				if ( ! isGenericSet ) { return undefined ; }
				pointer[ key ] = [] ;
			}

			pointer = pointer[ key ] ;

			continue ;
		}
		else if ( parts[ i ] === ']' ) {
			// Closing bracket: do nothing
			canBeEmpty = false ;
			continue ;
		}

		canBeEmpty = false ;

		if ( ! isArray ) { key = parts[ i ] ; continue ; }

		switch ( parts[ i ] ) {
			case 'length' :
				key = parts[ i ] ;
				break ;

			// Pseudo-key
			case 'first' :
				key = 0 ;
				break ;
			case 'last' :
				key = pointer.length - 1 ;
				if ( key < 0 ) { key = 0 ; }
				break ;
			case 'next' :
				if ( ! isGenericSet ) { return undefined ; }
				key = pointer.length ;
				break ;
			case 'insert' :
				if ( ! isGenericSet ) { return undefined ; }
				pointer.unshift( undefined ) ;
				key = 0 ;
				break ;

			// default = number
			default :
				// Convert the string key to a numerical index
				key = parseInt( parts[ i ] , 10 ) ;
		}
	}

	switch ( type ) {
		case 'get' :
			return pointer[ key ] ;
		case 'delete' :
			if ( isArray && typeof key === 'number' ) { pointer.splice( key , 1 ) ; }
			else { delete pointer[ key ] ; }
			return ;
		case 'set' :
			pointer[ key ] = value ;
			return pointer[ key ] ;
		case 'define' :
			// define: set only if it doesn't exist
			if ( ! ( key in pointer ) ) { pointer[ key ] = value ; }
			return pointer[ key ] ;
		case 'inc' :
			if ( typeof pointer[ key ] === 'number' ) { pointer[ key ] ++ ; }
			else if ( ! pointer[ key ] || typeof pointer[ key ] !== 'object' ) { pointer[ key ] = 1 ; }
			return pointer[ key ] ;
		case 'dec' :
			if ( typeof pointer[ key ] === 'number' ) { pointer[ key ] -- ; }
			else if ( ! pointer[ key ] || typeof pointer[ key ] !== 'object' ) { pointer[ key ] = -1 ; }
			return pointer[ key ] ;
		case 'append' :
			if ( ! pointer[ key ] ) { pointer[ key ] = [ value ] ; }
			else if ( Array.isArray( pointer[ key ] ) ) { pointer[ key ].push( value ) ; }
			//else ? do nothing???
			return pointer[ key ] ;
		case 'prepend' :
			if ( ! pointer[ key ] ) { pointer[ key ] = [ value ] ; }
			else if ( Array.isArray( pointer[ key ] ) ) { pointer[ key ].unshift( value ) ; }
			//else ? do nothing???
			return pointer[ key ] ;
		case 'concat' :
			if ( ! pointer[ key ] ) { pointer[ key ] = value ; }
			else if ( Array.isArray( pointer[ key ] ) && Array.isArray( value ) ) {
				pointer[ key ] = pointer[ key ].concat( value ) ;
			}
			//else ? do nothing???
			return pointer[ key ] ;
		case 'insert' :
			if ( ! pointer[ key ] ) { pointer[ key ] = value ; }
			else if ( Array.isArray( pointer[ key ] ) && Array.isArray( value ) ) {
				pointer[ key ] = value.concat( pointer[ key ] ) ;
			}
			//else ? do nothing???
			return pointer[ key ] ;
		case 'autoPush' :
			if ( pointer[ key ] === undefined ) { pointer[ key ] = value ; }
			else if ( Array.isArray( pointer[ key ] ) ) { pointer[ key ].push( value ) ; }
			else { pointer[ key ] = [ pointer[ key ] , value ] ; }
			return pointer[ key ] ;
	}
} ;



// get, set and delete use the same op() function
treePath.get = treePath.op.bind( undefined , 'get' ) ;
treePath.delete = treePath.op.bind( undefined , 'delete' ) ;
treePath.set = treePath.op.bind( undefined , 'set' ) ;
treePath.define = treePath.op.bind( undefined , 'define' ) ;
treePath.inc = treePath.op.bind( undefined , 'inc' ) ;
treePath.dec = treePath.op.bind( undefined , 'dec' ) ;
treePath.append = treePath.op.bind( undefined , 'append' ) ;
treePath.prepend = treePath.op.bind( undefined , 'prepend' ) ;
treePath.concat = treePath.op.bind( undefined , 'concat' ) ;
treePath.insert = treePath.op.bind( undefined , 'insert' ) ;
treePath.autoPush = treePath.op.bind( undefined , 'autoPush' ) ;



// Prototype used for object creation, so they can be created with Object.create( tree.path.prototype )
treePath.prototype = {
	get: function( path ) { return treePath.get( this , path ) ; } ,
	delete: function( path ) { return treePath.delete( this , path ) ; } ,
	set: function( path , value ) { return treePath.set( this , path , value ) ; } ,
	define: function( path , value ) { return treePath.define( this , path , value ) ; } ,
	inc: function( path , value ) { return treePath.inc( this , path , value ) ; } ,
	dec: function( path , value ) { return treePath.dec( this , path , value ) ; } ,
	append: function( path , value ) { return treePath.append( this , path , value ) ; } ,
	prepend: function( path , value ) { return treePath.prepend( this , path , value ) ; } ,
	concat: function( path , value ) { return treePath.concat( this , path , value ) ; } ,
	insert: function( path , value ) { return treePath.insert( this , path , value ) ; } ,
	autoPush: function( path , value ) { return treePath.autoPush( this , path , value ) ; }
} ;



// Upgrade an object so it can support get, set and delete at its root
treePath.upgrade = function upgrade( object ) {
	Object.defineProperties( object , {
		get: { value: treePath.op.bind( undefined , 'get' , object ) } ,
		delete: { value: treePath.op.bind( undefined , 'delete' , object ) } ,
		set: { value: treePath.op.bind( undefined , 'set' , object ) } ,
		define: { value: treePath.op.bind( undefined , 'define' , object ) } ,
		inc: { value: treePath.op.bind( undefined , 'inc' , object ) } ,
		dec: { value: treePath.op.bind( undefined , 'dec' , object ) } ,
		append: { value: treePath.op.bind( undefined , 'append' , object ) } ,
		prepend: { value: treePath.op.bind( undefined , 'prepend' , object ) } ,
		concat: { value: treePath.op.bind( undefined , 'concat' , object ) } ,
		insert: { value: treePath.op.bind( undefined , 'insert' , object ) } ,
		autoPush: { value: treePath.op.bind( undefined , 'autoPush' , object ) }
	} ) ;
} ;


},{}],38:[function(require,module,exports){
/*
	Tree Kit

	Copyright (c) 2014 - 2018 Cédric Ronvel

	The MIT License (MIT)

	Permission is hereby granted, free of charge, to any person obtaining a copy
	of this software and associated documentation files (the "Software"), to deal
	in the Software without restriction, including without limitation the rights
	to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
	copies of the Software, and to permit persons to whom the Software is
	furnished to do so, subject to the following conditions:

	The above copyright notice and this permission notice shall be included in all
	copies or substantial portions of the Software.

	THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
	IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
	FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
	AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
	LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
	OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
	SOFTWARE.
*/

"use strict" ;



var tree = {} ;
module.exports = tree ;


Object.assign( tree ,
	{
		extend: require( './extend.js' ) ,
		clone: require( './clone.js' ) ,
		path: require( './path.js' ) ,
		dotPath: require( './dotPath.js' )
	} ,
	require( './lazy.js' ) ,
	require( './diff.js' ) ,
	require( './mask.js' )
) ;


},{"./clone.js":31,"./diff.js":32,"./dotPath.js":33,"./extend.js":34,"./lazy.js":35,"./mask.js":36,"./path.js":37}],39:[function(require,module,exports){
'use strict'

exports.byteLength = byteLength
exports.toByteArray = toByteArray
exports.fromByteArray = fromByteArray

var lookup = []
var revLookup = []
var Arr = typeof Uint8Array !== 'undefined' ? Uint8Array : Array

var code = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/'
for (var i = 0, len = code.length; i < len; ++i) {
  lookup[i] = code[i]
  revLookup[code.charCodeAt(i)] = i
}

// Support decoding URL-safe base64 strings, as Node.js does.
// See: https://en.wikipedia.org/wiki/Base64#URL_applications
revLookup['-'.charCodeAt(0)] = 62
revLookup['_'.charCodeAt(0)] = 63

function getLens (b64) {
  var len = b64.length

  if (len % 4 > 0) {
    throw new Error('Invalid string. Length must be a multiple of 4')
  }

  // Trim off extra bytes after placeholder bytes are found
  // See: https://github.com/beatgammit/base64-js/issues/42
  var validLen = b64.indexOf('=')
  if (validLen === -1) validLen = len

  var placeHoldersLen = validLen === len
    ? 0
    : 4 - (validLen % 4)

  return [validLen, placeHoldersLen]
}

// base64 is 4/3 + up to two characters of the original data
function byteLength (b64) {
  var lens = getLens(b64)
  var validLen = lens[0]
  var placeHoldersLen = lens[1]
  return ((validLen + placeHoldersLen) * 3 / 4) - placeHoldersLen
}

function _byteLength (b64, validLen, placeHoldersLen) {
  return ((validLen + placeHoldersLen) * 3 / 4) - placeHoldersLen
}

function toByteArray (b64) {
  var tmp
  var lens = getLens(b64)
  var validLen = lens[0]
  var placeHoldersLen = lens[1]

  var arr = new Arr(_byteLength(b64, validLen, placeHoldersLen))

  var curByte = 0

  // if there are placeholders, only get up to the last complete 4 chars
  var len = placeHoldersLen > 0
    ? validLen - 4
    : validLen

  for (var i = 0; i < len; i += 4) {
    tmp =
      (revLookup[b64.charCodeAt(i)] << 18) |
      (revLookup[b64.charCodeAt(i + 1)] << 12) |
      (revLookup[b64.charCodeAt(i + 2)] << 6) |
      revLookup[b64.charCodeAt(i + 3)]
    arr[curByte++] = (tmp >> 16) & 0xFF
    arr[curByte++] = (tmp >> 8) & 0xFF
    arr[curByte++] = tmp & 0xFF
  }

  if (placeHoldersLen === 2) {
    tmp =
      (revLookup[b64.charCodeAt(i)] << 2) |
      (revLookup[b64.charCodeAt(i + 1)] >> 4)
    arr[curByte++] = tmp & 0xFF
  }

  if (placeHoldersLen === 1) {
    tmp =
      (revLookup[b64.charCodeAt(i)] << 10) |
      (revLookup[b64.charCodeAt(i + 1)] << 4) |
      (revLookup[b64.charCodeAt(i + 2)] >> 2)
    arr[curByte++] = (tmp >> 8) & 0xFF
    arr[curByte++] = tmp & 0xFF
  }

  return arr
}

function tripletToBase64 (num) {
  return lookup[num >> 18 & 0x3F] +
    lookup[num >> 12 & 0x3F] +
    lookup[num >> 6 & 0x3F] +
    lookup[num & 0x3F]
}

function encodeChunk (uint8, start, end) {
  var tmp
  var output = []
  for (var i = start; i < end; i += 3) {
    tmp =
      ((uint8[i] << 16) & 0xFF0000) +
      ((uint8[i + 1] << 8) & 0xFF00) +
      (uint8[i + 2] & 0xFF)
    output.push(tripletToBase64(tmp))
  }
  return output.join('')
}

function fromByteArray (uint8) {
  var tmp
  var len = uint8.length
  var extraBytes = len % 3 // if we have 1 byte left, pad 2 bytes
  var parts = []
  var maxChunkLength = 16383 // must be multiple of 3

  // go through the array every three bytes, we'll deal with trailing stuff later
  for (var i = 0, len2 = len - extraBytes; i < len2; i += maxChunkLength) {
    parts.push(encodeChunk(
      uint8, i, (i + maxChunkLength) > len2 ? len2 : (i + maxChunkLength)
    ))
  }

  // pad the end with zeros, but make sure to not forget the extra bytes
  if (extraBytes === 1) {
    tmp = uint8[len - 1]
    parts.push(
      lookup[tmp >> 2] +
      lookup[(tmp << 4) & 0x3F] +
      '=='
    )
  } else if (extraBytes === 2) {
    tmp = (uint8[len - 2] << 8) + uint8[len - 1]
    parts.push(
      lookup[tmp >> 10] +
      lookup[(tmp >> 4) & 0x3F] +
      lookup[(tmp << 2) & 0x3F] +
      '='
    )
  }

  return parts.join('')
}

},{}],40:[function(require,module,exports){
/*!
 * The buffer module from node.js, for the browser.
 *
 * @author   Feross Aboukhadijeh <https://feross.org>
 * @license  MIT
 */
/* eslint-disable no-proto */

'use strict'

var base64 = require('base64-js')
var ieee754 = require('ieee754')

exports.Buffer = Buffer
exports.SlowBuffer = SlowBuffer
exports.INSPECT_MAX_BYTES = 50

var K_MAX_LENGTH = 0x7fffffff
exports.kMaxLength = K_MAX_LENGTH

/**
 * If `Buffer.TYPED_ARRAY_SUPPORT`:
 *   === true    Use Uint8Array implementation (fastest)
 *   === false   Print warning and recommend using `buffer` v4.x which has an Object
 *               implementation (most compatible, even IE6)
 *
 * Browsers that support typed arrays are IE 10+, Firefox 4+, Chrome 7+, Safari 5.1+,
 * Opera 11.6+, iOS 4.2+.
 *
 * We report that the browser does not support typed arrays if the are not subclassable
 * using __proto__. Firefox 4-29 lacks support for adding new properties to `Uint8Array`
 * (See: https://bugzilla.mozilla.org/show_bug.cgi?id=695438). IE 10 lacks support
 * for __proto__ and has a buggy typed array implementation.
 */
Buffer.TYPED_ARRAY_SUPPORT = typedArraySupport()

if (!Buffer.TYPED_ARRAY_SUPPORT && typeof console !== 'undefined' &&
    typeof console.error === 'function') {
  console.error(
    'This browser lacks typed array (Uint8Array) support which is required by ' +
    '`buffer` v5.x. Use `buffer` v4.x if you require old browser support.'
  )
}

function typedArraySupport () {
  // Can typed array instances can be augmented?
  try {
    var arr = new Uint8Array(1)
    arr.__proto__ = { __proto__: Uint8Array.prototype, foo: function () { return 42 } }
    return arr.foo() === 42
  } catch (e) {
    return false
  }
}

Object.defineProperty(Buffer.prototype, 'parent', {
  enumerable: true,
  get: function () {
    if (!Buffer.isBuffer(this)) return undefined
    return this.buffer
  }
})

Object.defineProperty(Buffer.prototype, 'offset', {
  enumerable: true,
  get: function () {
    if (!Buffer.isBuffer(this)) return undefined
    return this.byteOffset
  }
})

function createBuffer (length) {
  if (length > K_MAX_LENGTH) {
    throw new RangeError('The value "' + length + '" is invalid for option "size"')
  }
  // Return an augmented `Uint8Array` instance
  var buf = new Uint8Array(length)
  buf.__proto__ = Buffer.prototype
  return buf
}

/**
 * The Buffer constructor returns instances of `Uint8Array` that have their
 * prototype changed to `Buffer.prototype`. Furthermore, `Buffer` is a subclass of
 * `Uint8Array`, so the returned instances will have all the node `Buffer` methods
 * and the `Uint8Array` methods. Square bracket notation works as expected -- it
 * returns a single octet.
 *
 * The `Uint8Array` prototype remains unmodified.
 */

function Buffer (arg, encodingOrOffset, length) {
  // Common case.
  if (typeof arg === 'number') {
    if (typeof encodingOrOffset === 'string') {
      throw new TypeError(
        'The "string" argument must be of type string. Received type number'
      )
    }
    return allocUnsafe(arg)
  }
  return from(arg, encodingOrOffset, length)
}

// Fix subarray() in ES2016. See: https://github.com/feross/buffer/pull/97
if (typeof Symbol !== 'undefined' && Symbol.species != null &&
    Buffer[Symbol.species] === Buffer) {
  Object.defineProperty(Buffer, Symbol.species, {
    value: null,
    configurable: true,
    enumerable: false,
    writable: false
  })
}

Buffer.poolSize = 8192 // not used by this implementation

function from (value, encodingOrOffset, length) {
  if (typeof value === 'string') {
    return fromString(value, encodingOrOffset)
  }

  if (ArrayBuffer.isView(value)) {
    return fromArrayLike(value)
  }

  if (value == null) {
    throw TypeError(
      'The first argument must be one of type string, Buffer, ArrayBuffer, Array, ' +
      'or Array-like Object. Received type ' + (typeof value)
    )
  }

  if (isInstance(value, ArrayBuffer) ||
      (value && isInstance(value.buffer, ArrayBuffer))) {
    return fromArrayBuffer(value, encodingOrOffset, length)
  }

  if (typeof value === 'number') {
    throw new TypeError(
      'The "value" argument must not be of type number. Received type number'
    )
  }

  var valueOf = value.valueOf && value.valueOf()
  if (valueOf != null && valueOf !== value) {
    return Buffer.from(valueOf, encodingOrOffset, length)
  }

  var b = fromObject(value)
  if (b) return b

  if (typeof Symbol !== 'undefined' && Symbol.toPrimitive != null &&
      typeof value[Symbol.toPrimitive] === 'function') {
    return Buffer.from(
      value[Symbol.toPrimitive]('string'), encodingOrOffset, length
    )
  }

  throw new TypeError(
    'The first argument must be one of type string, Buffer, ArrayBuffer, Array, ' +
    'or Array-like Object. Received type ' + (typeof value)
  )
}

/**
 * Functionally equivalent to Buffer(arg, encoding) but throws a TypeError
 * if value is a number.
 * Buffer.from(str[, encoding])
 * Buffer.from(array)
 * Buffer.from(buffer)
 * Buffer.from(arrayBuffer[, byteOffset[, length]])
 **/
Buffer.from = function (value, encodingOrOffset, length) {
  return from(value, encodingOrOffset, length)
}

// Note: Change prototype *after* Buffer.from is defined to workaround Chrome bug:
// https://github.com/feross/buffer/pull/148
Buffer.prototype.__proto__ = Uint8Array.prototype
Buffer.__proto__ = Uint8Array

function assertSize (size) {
  if (typeof size !== 'number') {
    throw new TypeError('"size" argument must be of type number')
  } else if (size < 0) {
    throw new RangeError('The value "' + size + '" is invalid for option "size"')
  }
}

function alloc (size, fill, encoding) {
  assertSize(size)
  if (size <= 0) {
    return createBuffer(size)
  }
  if (fill !== undefined) {
    // Only pay attention to encoding if it's a string. This
    // prevents accidentally sending in a number that would
    // be interpretted as a start offset.
    return typeof encoding === 'string'
      ? createBuffer(size).fill(fill, encoding)
      : createBuffer(size).fill(fill)
  }
  return createBuffer(size)
}

/**
 * Creates a new filled Buffer instance.
 * alloc(size[, fill[, encoding]])
 **/
Buffer.alloc = function (size, fill, encoding) {
  return alloc(size, fill, encoding)
}

function allocUnsafe (size) {
  assertSize(size)
  return createBuffer(size < 0 ? 0 : checked(size) | 0)
}

/**
 * Equivalent to Buffer(num), by default creates a non-zero-filled Buffer instance.
 * */
Buffer.allocUnsafe = function (size) {
  return allocUnsafe(size)
}
/**
 * Equivalent to SlowBuffer(num), by default creates a non-zero-filled Buffer instance.
 */
Buffer.allocUnsafeSlow = function (size) {
  return allocUnsafe(size)
}

function fromString (string, encoding) {
  if (typeof encoding !== 'string' || encoding === '') {
    encoding = 'utf8'
  }

  if (!Buffer.isEncoding(encoding)) {
    throw new TypeError('Unknown encoding: ' + encoding)
  }

  var length = byteLength(string, encoding) | 0
  var buf = createBuffer(length)

  var actual = buf.write(string, encoding)

  if (actual !== length) {
    // Writing a hex string, for example, that contains invalid characters will
    // cause everything after the first invalid character to be ignored. (e.g.
    // 'abxxcd' will be treated as 'ab')
    buf = buf.slice(0, actual)
  }

  return buf
}

function fromArrayLike (array) {
  var length = array.length < 0 ? 0 : checked(array.length) | 0
  var buf = createBuffer(length)
  for (var i = 0; i < length; i += 1) {
    buf[i] = array[i] & 255
  }
  return buf
}

function fromArrayBuffer (array, byteOffset, length) {
  if (byteOffset < 0 || array.byteLength < byteOffset) {
    throw new RangeError('"offset" is outside of buffer bounds')
  }

  if (array.byteLength < byteOffset + (length || 0)) {
    throw new RangeError('"length" is outside of buffer bounds')
  }

  var buf
  if (byteOffset === undefined && length === undefined) {
    buf = new Uint8Array(array)
  } else if (length === undefined) {
    buf = new Uint8Array(array, byteOffset)
  } else {
    buf = new Uint8Array(array, byteOffset, length)
  }

  // Return an augmented `Uint8Array` instance
  buf.__proto__ = Buffer.prototype
  return buf
}

function fromObject (obj) {
  if (Buffer.isBuffer(obj)) {
    var len = checked(obj.length) | 0
    var buf = createBuffer(len)

    if (buf.length === 0) {
      return buf
    }

    obj.copy(buf, 0, 0, len)
    return buf
  }

  if (obj.length !== undefined) {
    if (typeof obj.length !== 'number' || numberIsNaN(obj.length)) {
      return createBuffer(0)
    }
    return fromArrayLike(obj)
  }

  if (obj.type === 'Buffer' && Array.isArray(obj.data)) {
    return fromArrayLike(obj.data)
  }
}

function checked (length) {
  // Note: cannot use `length < K_MAX_LENGTH` here because that fails when
  // length is NaN (which is otherwise coerced to zero.)
  if (length >= K_MAX_LENGTH) {
    throw new RangeError('Attempt to allocate Buffer larger than maximum ' +
                         'size: 0x' + K_MAX_LENGTH.toString(16) + ' bytes')
  }
  return length | 0
}

function SlowBuffer (length) {
  if (+length != length) { // eslint-disable-line eqeqeq
    length = 0
  }
  return Buffer.alloc(+length)
}

Buffer.isBuffer = function isBuffer (b) {
  return b != null && b._isBuffer === true &&
    b !== Buffer.prototype // so Buffer.isBuffer(Buffer.prototype) will be false
}

Buffer.compare = function compare (a, b) {
  if (isInstance(a, Uint8Array)) a = Buffer.from(a, a.offset, a.byteLength)
  if (isInstance(b, Uint8Array)) b = Buffer.from(b, b.offset, b.byteLength)
  if (!Buffer.isBuffer(a) || !Buffer.isBuffer(b)) {
    throw new TypeError(
      'The "buf1", "buf2" arguments must be one of type Buffer or Uint8Array'
    )
  }

  if (a === b) return 0

  var x = a.length
  var y = b.length

  for (var i = 0, len = Math.min(x, y); i < len; ++i) {
    if (a[i] !== b[i]) {
      x = a[i]
      y = b[i]
      break
    }
  }

  if (x < y) return -1
  if (y < x) return 1
  return 0
}

Buffer.isEncoding = function isEncoding (encoding) {
  switch (String(encoding).toLowerCase()) {
    case 'hex':
    case 'utf8':
    case 'utf-8':
    case 'ascii':
    case 'latin1':
    case 'binary':
    case 'base64':
    case 'ucs2':
    case 'ucs-2':
    case 'utf16le':
    case 'utf-16le':
      return true
    default:
      return false
  }
}

Buffer.concat = function concat (list, length) {
  if (!Array.isArray(list)) {
    throw new TypeError('"list" argument must be an Array of Buffers')
  }

  if (list.length === 0) {
    return Buffer.alloc(0)
  }

  var i
  if (length === undefined) {
    length = 0
    for (i = 0; i < list.length; ++i) {
      length += list[i].length
    }
  }

  var buffer = Buffer.allocUnsafe(length)
  var pos = 0
  for (i = 0; i < list.length; ++i) {
    var buf = list[i]
    if (isInstance(buf, Uint8Array)) {
      buf = Buffer.from(buf)
    }
    if (!Buffer.isBuffer(buf)) {
      throw new TypeError('"list" argument must be an Array of Buffers')
    }
    buf.copy(buffer, pos)
    pos += buf.length
  }
  return buffer
}

function byteLength (string, encoding) {
  if (Buffer.isBuffer(string)) {
    return string.length
  }
  if (ArrayBuffer.isView(string) || isInstance(string, ArrayBuffer)) {
    return string.byteLength
  }
  if (typeof string !== 'string') {
    throw new TypeError(
      'The "string" argument must be one of type string, Buffer, or ArrayBuffer. ' +
      'Received type ' + typeof string
    )
  }

  var len = string.length
  var mustMatch = (arguments.length > 2 && arguments[2] === true)
  if (!mustMatch && len === 0) return 0

  // Use a for loop to avoid recursion
  var loweredCase = false
  for (;;) {
    switch (encoding) {
      case 'ascii':
      case 'latin1':
      case 'binary':
        return len
      case 'utf8':
      case 'utf-8':
        return utf8ToBytes(string).length
      case 'ucs2':
      case 'ucs-2':
      case 'utf16le':
      case 'utf-16le':
        return len * 2
      case 'hex':
        return len >>> 1
      case 'base64':
        return base64ToBytes(string).length
      default:
        if (loweredCase) {
          return mustMatch ? -1 : utf8ToBytes(string).length // assume utf8
        }
        encoding = ('' + encoding).toLowerCase()
        loweredCase = true
    }
  }
}
Buffer.byteLength = byteLength

function slowToString (encoding, start, end) {
  var loweredCase = false

  // No need to verify that "this.length <= MAX_UINT32" since it's a read-only
  // property of a typed array.

  // This behaves neither like String nor Uint8Array in that we set start/end
  // to their upper/lower bounds if the value passed is out of range.
  // undefined is handled specially as per ECMA-262 6th Edition,
  // Section 13.3.3.7 Runtime Semantics: KeyedBindingInitialization.
  if (start === undefined || start < 0) {
    start = 0
  }
  // Return early if start > this.length. Done here to prevent potential uint32
  // coercion fail below.
  if (start > this.length) {
    return ''
  }

  if (end === undefined || end > this.length) {
    end = this.length
  }

  if (end <= 0) {
    return ''
  }

  // Force coersion to uint32. This will also coerce falsey/NaN values to 0.
  end >>>= 0
  start >>>= 0

  if (end <= start) {
    return ''
  }

  if (!encoding) encoding = 'utf8'

  while (true) {
    switch (encoding) {
      case 'hex':
        return hexSlice(this, start, end)

      case 'utf8':
      case 'utf-8':
        return utf8Slice(this, start, end)

      case 'ascii':
        return asciiSlice(this, start, end)

      case 'latin1':
      case 'binary':
        return latin1Slice(this, start, end)

      case 'base64':
        return base64Slice(this, start, end)

      case 'ucs2':
      case 'ucs-2':
      case 'utf16le':
      case 'utf-16le':
        return utf16leSlice(this, start, end)

      default:
        if (loweredCase) throw new TypeError('Unknown encoding: ' + encoding)
        encoding = (encoding + '').toLowerCase()
        loweredCase = true
    }
  }
}

// This property is used by `Buffer.isBuffer` (and the `is-buffer` npm package)
// to detect a Buffer instance. It's not possible to use `instanceof Buffer`
// reliably in a browserify context because there could be multiple different
// copies of the 'buffer' package in use. This method works even for Buffer
// instances that were created from another copy of the `buffer` package.
// See: https://github.com/feross/buffer/issues/154
Buffer.prototype._isBuffer = true

function swap (b, n, m) {
  var i = b[n]
  b[n] = b[m]
  b[m] = i
}

Buffer.prototype.swap16 = function swap16 () {
  var len = this.length
  if (len % 2 !== 0) {
    throw new RangeError('Buffer size must be a multiple of 16-bits')
  }
  for (var i = 0; i < len; i += 2) {
    swap(this, i, i + 1)
  }
  return this
}

Buffer.prototype.swap32 = function swap32 () {
  var len = this.length
  if (len % 4 !== 0) {
    throw new RangeError('Buffer size must be a multiple of 32-bits')
  }
  for (var i = 0; i < len; i += 4) {
    swap(this, i, i + 3)
    swap(this, i + 1, i + 2)
  }
  return this
}

Buffer.prototype.swap64 = function swap64 () {
  var len = this.length
  if (len % 8 !== 0) {
    throw new RangeError('Buffer size must be a multiple of 64-bits')
  }
  for (var i = 0; i < len; i += 8) {
    swap(this, i, i + 7)
    swap(this, i + 1, i + 6)
    swap(this, i + 2, i + 5)
    swap(this, i + 3, i + 4)
  }
  return this
}

Buffer.prototype.toString = function toString () {
  var length = this.length
  if (length === 0) return ''
  if (arguments.length === 0) return utf8Slice(this, 0, length)
  return slowToString.apply(this, arguments)
}

Buffer.prototype.toLocaleString = Buffer.prototype.toString

Buffer.prototype.equals = function equals (b) {
  if (!Buffer.isBuffer(b)) throw new TypeError('Argument must be a Buffer')
  if (this === b) return true
  return Buffer.compare(this, b) === 0
}

Buffer.prototype.inspect = function inspect () {
  var str = ''
  var max = exports.INSPECT_MAX_BYTES
  str = this.toString('hex', 0, max).replace(/(.{2})/g, '$1 ').trim()
  if (this.length > max) str += ' ... '
  return '<Buffer ' + str + '>'
}

Buffer.prototype.compare = function compare (target, start, end, thisStart, thisEnd) {
  if (isInstance(target, Uint8Array)) {
    target = Buffer.from(target, target.offset, target.byteLength)
  }
  if (!Buffer.isBuffer(target)) {
    throw new TypeError(
      'The "target" argument must be one of type Buffer or Uint8Array. ' +
      'Received type ' + (typeof target)
    )
  }

  if (start === undefined) {
    start = 0
  }
  if (end === undefined) {
    end = target ? target.length : 0
  }
  if (thisStart === undefined) {
    thisStart = 0
  }
  if (thisEnd === undefined) {
    thisEnd = this.length
  }

  if (start < 0 || end > target.length || thisStart < 0 || thisEnd > this.length) {
    throw new RangeError('out of range index')
  }

  if (thisStart >= thisEnd && start >= end) {
    return 0
  }
  if (thisStart >= thisEnd) {
    return -1
  }
  if (start >= end) {
    return 1
  }

  start >>>= 0
  end >>>= 0
  thisStart >>>= 0
  thisEnd >>>= 0

  if (this === target) return 0

  var x = thisEnd - thisStart
  var y = end - start
  var len = Math.min(x, y)

  var thisCopy = this.slice(thisStart, thisEnd)
  var targetCopy = target.slice(start, end)

  for (var i = 0; i < len; ++i) {
    if (thisCopy[i] !== targetCopy[i]) {
      x = thisCopy[i]
      y = targetCopy[i]
      break
    }
  }

  if (x < y) return -1
  if (y < x) return 1
  return 0
}

// Finds either the first index of `val` in `buffer` at offset >= `byteOffset`,
// OR the last index of `val` in `buffer` at offset <= `byteOffset`.
//
// Arguments:
// - buffer - a Buffer to search
// - val - a string, Buffer, or number
// - byteOffset - an index into `buffer`; will be clamped to an int32
// - encoding - an optional encoding, relevant is val is a string
// - dir - true for indexOf, false for lastIndexOf
function bidirectionalIndexOf (buffer, val, byteOffset, encoding, dir) {
  // Empty buffer means no match
  if (buffer.length === 0) return -1

  // Normalize byteOffset
  if (typeof byteOffset === 'string') {
    encoding = byteOffset
    byteOffset = 0
  } else if (byteOffset > 0x7fffffff) {
    byteOffset = 0x7fffffff
  } else if (byteOffset < -0x80000000) {
    byteOffset = -0x80000000
  }
  byteOffset = +byteOffset // Coerce to Number.
  if (numberIsNaN(byteOffset)) {
    // byteOffset: it it's undefined, null, NaN, "foo", etc, search whole buffer
    byteOffset = dir ? 0 : (buffer.length - 1)
  }

  // Normalize byteOffset: negative offsets start from the end of the buffer
  if (byteOffset < 0) byteOffset = buffer.length + byteOffset
  if (byteOffset >= buffer.length) {
    if (dir) return -1
    else byteOffset = buffer.length - 1
  } else if (byteOffset < 0) {
    if (dir) byteOffset = 0
    else return -1
  }

  // Normalize val
  if (typeof val === 'string') {
    val = Buffer.from(val, encoding)
  }

  // Finally, search either indexOf (if dir is true) or lastIndexOf
  if (Buffer.isBuffer(val)) {
    // Special case: looking for empty string/buffer always fails
    if (val.length === 0) {
      return -1
    }
    return arrayIndexOf(buffer, val, byteOffset, encoding, dir)
  } else if (typeof val === 'number') {
    val = val & 0xFF // Search for a byte value [0-255]
    if (typeof Uint8Array.prototype.indexOf === 'function') {
      if (dir) {
        return Uint8Array.prototype.indexOf.call(buffer, val, byteOffset)
      } else {
        return Uint8Array.prototype.lastIndexOf.call(buffer, val, byteOffset)
      }
    }
    return arrayIndexOf(buffer, [ val ], byteOffset, encoding, dir)
  }

  throw new TypeError('val must be string, number or Buffer')
}

function arrayIndexOf (arr, val, byteOffset, encoding, dir) {
  var indexSize = 1
  var arrLength = arr.length
  var valLength = val.length

  if (encoding !== undefined) {
    encoding = String(encoding).toLowerCase()
    if (encoding === 'ucs2' || encoding === 'ucs-2' ||
        encoding === 'utf16le' || encoding === 'utf-16le') {
      if (arr.length < 2 || val.length < 2) {
        return -1
      }
      indexSize = 2
      arrLength /= 2
      valLength /= 2
      byteOffset /= 2
    }
  }

  function read (buf, i) {
    if (indexSize === 1) {
      return buf[i]
    } else {
      return buf.readUInt16BE(i * indexSize)
    }
  }

  var i
  if (dir) {
    var foundIndex = -1
    for (i = byteOffset; i < arrLength; i++) {
      if (read(arr, i) === read(val, foundIndex === -1 ? 0 : i - foundIndex)) {
        if (foundIndex === -1) foundIndex = i
        if (i - foundIndex + 1 === valLength) return foundIndex * indexSize
      } else {
        if (foundIndex !== -1) i -= i - foundIndex
        foundIndex = -1
      }
    }
  } else {
    if (byteOffset + valLength > arrLength) byteOffset = arrLength - valLength
    for (i = byteOffset; i >= 0; i--) {
      var found = true
      for (var j = 0; j < valLength; j++) {
        if (read(arr, i + j) !== read(val, j)) {
          found = false
          break
        }
      }
      if (found) return i
    }
  }

  return -1
}

Buffer.prototype.includes = function includes (val, byteOffset, encoding) {
  return this.indexOf(val, byteOffset, encoding) !== -1
}

Buffer.prototype.indexOf = function indexOf (val, byteOffset, encoding) {
  return bidirectionalIndexOf(this, val, byteOffset, encoding, true)
}

Buffer.prototype.lastIndexOf = function lastIndexOf (val, byteOffset, encoding) {
  return bidirectionalIndexOf(this, val, byteOffset, encoding, false)
}

function hexWrite (buf, string, offset, length) {
  offset = Number(offset) || 0
  var remaining = buf.length - offset
  if (!length) {
    length = remaining
  } else {
    length = Number(length)
    if (length > remaining) {
      length = remaining
    }
  }

  var strLen = string.length

  if (length > strLen / 2) {
    length = strLen / 2
  }
  for (var i = 0; i < length; ++i) {
    var parsed = parseInt(string.substr(i * 2, 2), 16)
    if (numberIsNaN(parsed)) return i
    buf[offset + i] = parsed
  }
  return i
}

function utf8Write (buf, string, offset, length) {
  return blitBuffer(utf8ToBytes(string, buf.length - offset), buf, offset, length)
}

function asciiWrite (buf, string, offset, length) {
  return blitBuffer(asciiToBytes(string), buf, offset, length)
}

function latin1Write (buf, string, offset, length) {
  return asciiWrite(buf, string, offset, length)
}

function base64Write (buf, string, offset, length) {
  return blitBuffer(base64ToBytes(string), buf, offset, length)
}

function ucs2Write (buf, string, offset, length) {
  return blitBuffer(utf16leToBytes(string, buf.length - offset), buf, offset, length)
}

Buffer.prototype.write = function write (string, offset, length, encoding) {
  // Buffer#write(string)
  if (offset === undefined) {
    encoding = 'utf8'
    length = this.length
    offset = 0
  // Buffer#write(string, encoding)
  } else if (length === undefined && typeof offset === 'string') {
    encoding = offset
    length = this.length
    offset = 0
  // Buffer#write(string, offset[, length][, encoding])
  } else if (isFinite(offset)) {
    offset = offset >>> 0
    if (isFinite(length)) {
      length = length >>> 0
      if (encoding === undefined) encoding = 'utf8'
    } else {
      encoding = length
      length = undefined
    }
  } else {
    throw new Error(
      'Buffer.write(string, encoding, offset[, length]) is no longer supported'
    )
  }

  var remaining = this.length - offset
  if (length === undefined || length > remaining) length = remaining

  if ((string.length > 0 && (length < 0 || offset < 0)) || offset > this.length) {
    throw new RangeError('Attempt to write outside buffer bounds')
  }

  if (!encoding) encoding = 'utf8'

  var loweredCase = false
  for (;;) {
    switch (encoding) {
      case 'hex':
        return hexWrite(this, string, offset, length)

      case 'utf8':
      case 'utf-8':
        return utf8Write(this, string, offset, length)

      case 'ascii':
        return asciiWrite(this, string, offset, length)

      case 'latin1':
      case 'binary':
        return latin1Write(this, string, offset, length)

      case 'base64':
        // Warning: maxLength not taken into account in base64Write
        return base64Write(this, string, offset, length)

      case 'ucs2':
      case 'ucs-2':
      case 'utf16le':
      case 'utf-16le':
        return ucs2Write(this, string, offset, length)

      default:
        if (loweredCase) throw new TypeError('Unknown encoding: ' + encoding)
        encoding = ('' + encoding).toLowerCase()
        loweredCase = true
    }
  }
}

Buffer.prototype.toJSON = function toJSON () {
  return {
    type: 'Buffer',
    data: Array.prototype.slice.call(this._arr || this, 0)
  }
}

function base64Slice (buf, start, end) {
  if (start === 0 && end === buf.length) {
    return base64.fromByteArray(buf)
  } else {
    return base64.fromByteArray(buf.slice(start, end))
  }
}

function utf8Slice (buf, start, end) {
  end = Math.min(buf.length, end)
  var res = []

  var i = start
  while (i < end) {
    var firstByte = buf[i]
    var codePoint = null
    var bytesPerSequence = (firstByte > 0xEF) ? 4
      : (firstByte > 0xDF) ? 3
        : (firstByte > 0xBF) ? 2
          : 1

    if (i + bytesPerSequence <= end) {
      var secondByte, thirdByte, fourthByte, tempCodePoint

      switch (bytesPerSequence) {
        case 1:
          if (firstByte < 0x80) {
            codePoint = firstByte
          }
          break
        case 2:
          secondByte = buf[i + 1]
          if ((secondByte & 0xC0) === 0x80) {
            tempCodePoint = (firstByte & 0x1F) << 0x6 | (secondByte & 0x3F)
            if (tempCodePoint > 0x7F) {
              codePoint = tempCodePoint
            }
          }
          break
        case 3:
          secondByte = buf[i + 1]
          thirdByte = buf[i + 2]
          if ((secondByte & 0xC0) === 0x80 && (thirdByte & 0xC0) === 0x80) {
            tempCodePoint = (firstByte & 0xF) << 0xC | (secondByte & 0x3F) << 0x6 | (thirdByte & 0x3F)
            if (tempCodePoint > 0x7FF && (tempCodePoint < 0xD800 || tempCodePoint > 0xDFFF)) {
              codePoint = tempCodePoint
            }
          }
          break
        case 4:
          secondByte = buf[i + 1]
          thirdByte = buf[i + 2]
          fourthByte = buf[i + 3]
          if ((secondByte & 0xC0) === 0x80 && (thirdByte & 0xC0) === 0x80 && (fourthByte & 0xC0) === 0x80) {
            tempCodePoint = (firstByte & 0xF) << 0x12 | (secondByte & 0x3F) << 0xC | (thirdByte & 0x3F) << 0x6 | (fourthByte & 0x3F)
            if (tempCodePoint > 0xFFFF && tempCodePoint < 0x110000) {
              codePoint = tempCodePoint
            }
          }
      }
    }

    if (codePoint === null) {
      // we did not generate a valid codePoint so insert a
      // replacement char (U+FFFD) and advance only 1 byte
      codePoint = 0xFFFD
      bytesPerSequence = 1
    } else if (codePoint > 0xFFFF) {
      // encode to utf16 (surrogate pair dance)
      codePoint -= 0x10000
      res.push(codePoint >>> 10 & 0x3FF | 0xD800)
      codePoint = 0xDC00 | codePoint & 0x3FF
    }

    res.push(codePoint)
    i += bytesPerSequence
  }

  return decodeCodePointsArray(res)
}

// Based on http://stackoverflow.com/a/22747272/680742, the browser with
// the lowest limit is Chrome, with 0x10000 args.
// We go 1 magnitude less, for safety
var MAX_ARGUMENTS_LENGTH = 0x1000

function decodeCodePointsArray (codePoints) {
  var len = codePoints.length
  if (len <= MAX_ARGUMENTS_LENGTH) {
    return String.fromCharCode.apply(String, codePoints) // avoid extra slice()
  }

  // Decode in chunks to avoid "call stack size exceeded".
  var res = ''
  var i = 0
  while (i < len) {
    res += String.fromCharCode.apply(
      String,
      codePoints.slice(i, i += MAX_ARGUMENTS_LENGTH)
    )
  }
  return res
}

function asciiSlice (buf, start, end) {
  var ret = ''
  end = Math.min(buf.length, end)

  for (var i = start; i < end; ++i) {
    ret += String.fromCharCode(buf[i] & 0x7F)
  }
  return ret
}

function latin1Slice (buf, start, end) {
  var ret = ''
  end = Math.min(buf.length, end)

  for (var i = start; i < end; ++i) {
    ret += String.fromCharCode(buf[i])
  }
  return ret
}

function hexSlice (buf, start, end) {
  var len = buf.length

  if (!start || start < 0) start = 0
  if (!end || end < 0 || end > len) end = len

  var out = ''
  for (var i = start; i < end; ++i) {
    out += toHex(buf[i])
  }
  return out
}

function utf16leSlice (buf, start, end) {
  var bytes = buf.slice(start, end)
  var res = ''
  for (var i = 0; i < bytes.length; i += 2) {
    res += String.fromCharCode(bytes[i] + (bytes[i + 1] * 256))
  }
  return res
}

Buffer.prototype.slice = function slice (start, end) {
  var len = this.length
  start = ~~start
  end = end === undefined ? len : ~~end

  if (start < 0) {
    start += len
    if (start < 0) start = 0
  } else if (start > len) {
    start = len
  }

  if (end < 0) {
    end += len
    if (end < 0) end = 0
  } else if (end > len) {
    end = len
  }

  if (end < start) end = start

  var newBuf = this.subarray(start, end)
  // Return an augmented `Uint8Array` instance
  newBuf.__proto__ = Buffer.prototype
  return newBuf
}

/*
 * Need to make sure that buffer isn't trying to write out of bounds.
 */
function checkOffset (offset, ext, length) {
  if ((offset % 1) !== 0 || offset < 0) throw new RangeError('offset is not uint')
  if (offset + ext > length) throw new RangeError('Trying to access beyond buffer length')
}

Buffer.prototype.readUIntLE = function readUIntLE (offset, byteLength, noAssert) {
  offset = offset >>> 0
  byteLength = byteLength >>> 0
  if (!noAssert) checkOffset(offset, byteLength, this.length)

  var val = this[offset]
  var mul = 1
  var i = 0
  while (++i < byteLength && (mul *= 0x100)) {
    val += this[offset + i] * mul
  }

  return val
}

Buffer.prototype.readUIntBE = function readUIntBE (offset, byteLength, noAssert) {
  offset = offset >>> 0
  byteLength = byteLength >>> 0
  if (!noAssert) {
    checkOffset(offset, byteLength, this.length)
  }

  var val = this[offset + --byteLength]
  var mul = 1
  while (byteLength > 0 && (mul *= 0x100)) {
    val += this[offset + --byteLength] * mul
  }

  return val
}

Buffer.prototype.readUInt8 = function readUInt8 (offset, noAssert) {
  offset = offset >>> 0
  if (!noAssert) checkOffset(offset, 1, this.length)
  return this[offset]
}

Buffer.prototype.readUInt16LE = function readUInt16LE (offset, noAssert) {
  offset = offset >>> 0
  if (!noAssert) checkOffset(offset, 2, this.length)
  return this[offset] | (this[offset + 1] << 8)
}

Buffer.prototype.readUInt16BE = function readUInt16BE (offset, noAssert) {
  offset = offset >>> 0
  if (!noAssert) checkOffset(offset, 2, this.length)
  return (this[offset] << 8) | this[offset + 1]
}

Buffer.prototype.readUInt32LE = function readUInt32LE (offset, noAssert) {
  offset = offset >>> 0
  if (!noAssert) checkOffset(offset, 4, this.length)

  return ((this[offset]) |
      (this[offset + 1] << 8) |
      (this[offset + 2] << 16)) +
      (this[offset + 3] * 0x1000000)
}

Buffer.prototype.readUInt32BE = function readUInt32BE (offset, noAssert) {
  offset = offset >>> 0
  if (!noAssert) checkOffset(offset, 4, this.length)

  return (this[offset] * 0x1000000) +
    ((this[offset + 1] << 16) |
    (this[offset + 2] << 8) |
    this[offset + 3])
}

Buffer.prototype.readIntLE = function readIntLE (offset, byteLength, noAssert) {
  offset = offset >>> 0
  byteLength = byteLength >>> 0
  if (!noAssert) checkOffset(offset, byteLength, this.length)

  var val = this[offset]
  var mul = 1
  var i = 0
  while (++i < byteLength && (mul *= 0x100)) {
    val += this[offset + i] * mul
  }
  mul *= 0x80

  if (val >= mul) val -= Math.pow(2, 8 * byteLength)

  return val
}

Buffer.prototype.readIntBE = function readIntBE (offset, byteLength, noAssert) {
  offset = offset >>> 0
  byteLength = byteLength >>> 0
  if (!noAssert) checkOffset(offset, byteLength, this.length)

  var i = byteLength
  var mul = 1
  var val = this[offset + --i]
  while (i > 0 && (mul *= 0x100)) {
    val += this[offset + --i] * mul
  }
  mul *= 0x80

  if (val >= mul) val -= Math.pow(2, 8 * byteLength)

  return val
}

Buffer.prototype.readInt8 = function readInt8 (offset, noAssert) {
  offset = offset >>> 0
  if (!noAssert) checkOffset(offset, 1, this.length)
  if (!(this[offset] & 0x80)) return (this[offset])
  return ((0xff - this[offset] + 1) * -1)
}

Buffer.prototype.readInt16LE = function readInt16LE (offset, noAssert) {
  offset = offset >>> 0
  if (!noAssert) checkOffset(offset, 2, this.length)
  var val = this[offset] | (this[offset + 1] << 8)
  return (val & 0x8000) ? val | 0xFFFF0000 : val
}

Buffer.prototype.readInt16BE = function readInt16BE (offset, noAssert) {
  offset = offset >>> 0
  if (!noAssert) checkOffset(offset, 2, this.length)
  var val = this[offset + 1] | (this[offset] << 8)
  return (val & 0x8000) ? val | 0xFFFF0000 : val
}

Buffer.prototype.readInt32LE = function readInt32LE (offset, noAssert) {
  offset = offset >>> 0
  if (!noAssert) checkOffset(offset, 4, this.length)

  return (this[offset]) |
    (this[offset + 1] << 8) |
    (this[offset + 2] << 16) |
    (this[offset + 3] << 24)
}

Buffer.prototype.readInt32BE = function readInt32BE (offset, noAssert) {
  offset = offset >>> 0
  if (!noAssert) checkOffset(offset, 4, this.length)

  return (this[offset] << 24) |
    (this[offset + 1] << 16) |
    (this[offset + 2] << 8) |
    (this[offset + 3])
}

Buffer.prototype.readFloatLE = function readFloatLE (offset, noAssert) {
  offset = offset >>> 0
  if (!noAssert) checkOffset(offset, 4, this.length)
  return ieee754.read(this, offset, true, 23, 4)
}

Buffer.prototype.readFloatBE = function readFloatBE (offset, noAssert) {
  offset = offset >>> 0
  if (!noAssert) checkOffset(offset, 4, this.length)
  return ieee754.read(this, offset, false, 23, 4)
}

Buffer.prototype.readDoubleLE = function readDoubleLE (offset, noAssert) {
  offset = offset >>> 0
  if (!noAssert) checkOffset(offset, 8, this.length)
  return ieee754.read(this, offset, true, 52, 8)
}

Buffer.prototype.readDoubleBE = function readDoubleBE (offset, noAssert) {
  offset = offset >>> 0
  if (!noAssert) checkOffset(offset, 8, this.length)
  return ieee754.read(this, offset, false, 52, 8)
}

function checkInt (buf, value, offset, ext, max, min) {
  if (!Buffer.isBuffer(buf)) throw new TypeError('"buffer" argument must be a Buffer instance')
  if (value > max || value < min) throw new RangeError('"value" argument is out of bounds')
  if (offset + ext > buf.length) throw new RangeError('Index out of range')
}

Buffer.prototype.writeUIntLE = function writeUIntLE (value, offset, byteLength, noAssert) {
  value = +value
  offset = offset >>> 0
  byteLength = byteLength >>> 0
  if (!noAssert) {
    var maxBytes = Math.pow(2, 8 * byteLength) - 1
    checkInt(this, value, offset, byteLength, maxBytes, 0)
  }

  var mul = 1
  var i = 0
  this[offset] = value & 0xFF
  while (++i < byteLength && (mul *= 0x100)) {
    this[offset + i] = (value / mul) & 0xFF
  }

  return offset + byteLength
}

Buffer.prototype.writeUIntBE = function writeUIntBE (value, offset, byteLength, noAssert) {
  value = +value
  offset = offset >>> 0
  byteLength = byteLength >>> 0
  if (!noAssert) {
    var maxBytes = Math.pow(2, 8 * byteLength) - 1
    checkInt(this, value, offset, byteLength, maxBytes, 0)
  }

  var i = byteLength - 1
  var mul = 1
  this[offset + i] = value & 0xFF
  while (--i >= 0 && (mul *= 0x100)) {
    this[offset + i] = (value / mul) & 0xFF
  }

  return offset + byteLength
}

Buffer.prototype.writeUInt8 = function writeUInt8 (value, offset, noAssert) {
  value = +value
  offset = offset >>> 0
  if (!noAssert) checkInt(this, value, offset, 1, 0xff, 0)
  this[offset] = (value & 0xff)
  return offset + 1
}

Buffer.prototype.writeUInt16LE = function writeUInt16LE (value, offset, noAssert) {
  value = +value
  offset = offset >>> 0
  if (!noAssert) checkInt(this, value, offset, 2, 0xffff, 0)
  this[offset] = (value & 0xff)
  this[offset + 1] = (value >>> 8)
  return offset + 2
}

Buffer.prototype.writeUInt16BE = function writeUInt16BE (value, offset, noAssert) {
  value = +value
  offset = offset >>> 0
  if (!noAssert) checkInt(this, value, offset, 2, 0xffff, 0)
  this[offset] = (value >>> 8)
  this[offset + 1] = (value & 0xff)
  return offset + 2
}

Buffer.prototype.writeUInt32LE = function writeUInt32LE (value, offset, noAssert) {
  value = +value
  offset = offset >>> 0
  if (!noAssert) checkInt(this, value, offset, 4, 0xffffffff, 0)
  this[offset + 3] = (value >>> 24)
  this[offset + 2] = (value >>> 16)
  this[offset + 1] = (value >>> 8)
  this[offset] = (value & 0xff)
  return offset + 4
}

Buffer.prototype.writeUInt32BE = function writeUInt32BE (value, offset, noAssert) {
  value = +value
  offset = offset >>> 0
  if (!noAssert) checkInt(this, value, offset, 4, 0xffffffff, 0)
  this[offset] = (value >>> 24)
  this[offset + 1] = (value >>> 16)
  this[offset + 2] = (value >>> 8)
  this[offset + 3] = (value & 0xff)
  return offset + 4
}

Buffer.prototype.writeIntLE = function writeIntLE (value, offset, byteLength, noAssert) {
  value = +value
  offset = offset >>> 0
  if (!noAssert) {
    var limit = Math.pow(2, (8 * byteLength) - 1)

    checkInt(this, value, offset, byteLength, limit - 1, -limit)
  }

  var i = 0
  var mul = 1
  var sub = 0
  this[offset] = value & 0xFF
  while (++i < byteLength && (mul *= 0x100)) {
    if (value < 0 && sub === 0 && this[offset + i - 1] !== 0) {
      sub = 1
    }
    this[offset + i] = ((value / mul) >> 0) - sub & 0xFF
  }

  return offset + byteLength
}

Buffer.prototype.writeIntBE = function writeIntBE (value, offset, byteLength, noAssert) {
  value = +value
  offset = offset >>> 0
  if (!noAssert) {
    var limit = Math.pow(2, (8 * byteLength) - 1)

    checkInt(this, value, offset, byteLength, limit - 1, -limit)
  }

  var i = byteLength - 1
  var mul = 1
  var sub = 0
  this[offset + i] = value & 0xFF
  while (--i >= 0 && (mul *= 0x100)) {
    if (value < 0 && sub === 0 && this[offset + i + 1] !== 0) {
      sub = 1
    }
    this[offset + i] = ((value / mul) >> 0) - sub & 0xFF
  }

  return offset + byteLength
}

Buffer.prototype.writeInt8 = function writeInt8 (value, offset, noAssert) {
  value = +value
  offset = offset >>> 0
  if (!noAssert) checkInt(this, value, offset, 1, 0x7f, -0x80)
  if (value < 0) value = 0xff + value + 1
  this[offset] = (value & 0xff)
  return offset + 1
}

Buffer.prototype.writeInt16LE = function writeInt16LE (value, offset, noAssert) {
  value = +value
  offset = offset >>> 0
  if (!noAssert) checkInt(this, value, offset, 2, 0x7fff, -0x8000)
  this[offset] = (value & 0xff)
  this[offset + 1] = (value >>> 8)
  return offset + 2
}

Buffer.prototype.writeInt16BE = function writeInt16BE (value, offset, noAssert) {
  value = +value
  offset = offset >>> 0
  if (!noAssert) checkInt(this, value, offset, 2, 0x7fff, -0x8000)
  this[offset] = (value >>> 8)
  this[offset + 1] = (value & 0xff)
  return offset + 2
}

Buffer.prototype.writeInt32LE = function writeInt32LE (value, offset, noAssert) {
  value = +value
  offset = offset >>> 0
  if (!noAssert) checkInt(this, value, offset, 4, 0x7fffffff, -0x80000000)
  this[offset] = (value & 0xff)
  this[offset + 1] = (value >>> 8)
  this[offset + 2] = (value >>> 16)
  this[offset + 3] = (value >>> 24)
  return offset + 4
}

Buffer.prototype.writeInt32BE = function writeInt32BE (value, offset, noAssert) {
  value = +value
  offset = offset >>> 0
  if (!noAssert) checkInt(this, value, offset, 4, 0x7fffffff, -0x80000000)
  if (value < 0) value = 0xffffffff + value + 1
  this[offset] = (value >>> 24)
  this[offset + 1] = (value >>> 16)
  this[offset + 2] = (value >>> 8)
  this[offset + 3] = (value & 0xff)
  return offset + 4
}

function checkIEEE754 (buf, value, offset, ext, max, min) {
  if (offset + ext > buf.length) throw new RangeError('Index out of range')
  if (offset < 0) throw new RangeError('Index out of range')
}

function writeFloat (buf, value, offset, littleEndian, noAssert) {
  value = +value
  offset = offset >>> 0
  if (!noAssert) {
    checkIEEE754(buf, value, offset, 4, 3.4028234663852886e+38, -3.4028234663852886e+38)
  }
  ieee754.write(buf, value, offset, littleEndian, 23, 4)
  return offset + 4
}

Buffer.prototype.writeFloatLE = function writeFloatLE (value, offset, noAssert) {
  return writeFloat(this, value, offset, true, noAssert)
}

Buffer.prototype.writeFloatBE = function writeFloatBE (value, offset, noAssert) {
  return writeFloat(this, value, offset, false, noAssert)
}

function writeDouble (buf, value, offset, littleEndian, noAssert) {
  value = +value
  offset = offset >>> 0
  if (!noAssert) {
    checkIEEE754(buf, value, offset, 8, 1.7976931348623157E+308, -1.7976931348623157E+308)
  }
  ieee754.write(buf, value, offset, littleEndian, 52, 8)
  return offset + 8
}

Buffer.prototype.writeDoubleLE = function writeDoubleLE (value, offset, noAssert) {
  return writeDouble(this, value, offset, true, noAssert)
}

Buffer.prototype.writeDoubleBE = function writeDoubleBE (value, offset, noAssert) {
  return writeDouble(this, value, offset, false, noAssert)
}

// copy(targetBuffer, targetStart=0, sourceStart=0, sourceEnd=buffer.length)
Buffer.prototype.copy = function copy (target, targetStart, start, end) {
  if (!Buffer.isBuffer(target)) throw new TypeError('argument should be a Buffer')
  if (!start) start = 0
  if (!end && end !== 0) end = this.length
  if (targetStart >= target.length) targetStart = target.length
  if (!targetStart) targetStart = 0
  if (end > 0 && end < start) end = start

  // Copy 0 bytes; we're done
  if (end === start) return 0
  if (target.length === 0 || this.length === 0) return 0

  // Fatal error conditions
  if (targetStart < 0) {
    throw new RangeError('targetStart out of bounds')
  }
  if (start < 0 || start >= this.length) throw new RangeError('Index out of range')
  if (end < 0) throw new RangeError('sourceEnd out of bounds')

  // Are we oob?
  if (end > this.length) end = this.length
  if (target.length - targetStart < end - start) {
    end = target.length - targetStart + start
  }

  var len = end - start

  if (this === target && typeof Uint8Array.prototype.copyWithin === 'function') {
    // Use built-in when available, missing from IE11
    this.copyWithin(targetStart, start, end)
  } else if (this === target && start < targetStart && targetStart < end) {
    // descending copy from end
    for (var i = len - 1; i >= 0; --i) {
      target[i + targetStart] = this[i + start]
    }
  } else {
    Uint8Array.prototype.set.call(
      target,
      this.subarray(start, end),
      targetStart
    )
  }

  return len
}

// Usage:
//    buffer.fill(number[, offset[, end]])
//    buffer.fill(buffer[, offset[, end]])
//    buffer.fill(string[, offset[, end]][, encoding])
Buffer.prototype.fill = function fill (val, start, end, encoding) {
  // Handle string cases:
  if (typeof val === 'string') {
    if (typeof start === 'string') {
      encoding = start
      start = 0
      end = this.length
    } else if (typeof end === 'string') {
      encoding = end
      end = this.length
    }
    if (encoding !== undefined && typeof encoding !== 'string') {
      throw new TypeError('encoding must be a string')
    }
    if (typeof encoding === 'string' && !Buffer.isEncoding(encoding)) {
      throw new TypeError('Unknown encoding: ' + encoding)
    }
    if (val.length === 1) {
      var code = val.charCodeAt(0)
      if ((encoding === 'utf8' && code < 128) ||
          encoding === 'latin1') {
        // Fast path: If `val` fits into a single byte, use that numeric value.
        val = code
      }
    }
  } else if (typeof val === 'number') {
    val = val & 255
  }

  // Invalid ranges are not set to a default, so can range check early.
  if (start < 0 || this.length < start || this.length < end) {
    throw new RangeError('Out of range index')
  }

  if (end <= start) {
    return this
  }

  start = start >>> 0
  end = end === undefined ? this.length : end >>> 0

  if (!val) val = 0

  var i
  if (typeof val === 'number') {
    for (i = start; i < end; ++i) {
      this[i] = val
    }
  } else {
    var bytes = Buffer.isBuffer(val)
      ? val
      : Buffer.from(val, encoding)
    var len = bytes.length
    if (len === 0) {
      throw new TypeError('The value "' + val +
        '" is invalid for argument "value"')
    }
    for (i = 0; i < end - start; ++i) {
      this[i + start] = bytes[i % len]
    }
  }

  return this
}

// HELPER FUNCTIONS
// ================

var INVALID_BASE64_RE = /[^+/0-9A-Za-z-_]/g

function base64clean (str) {
  // Node takes equal signs as end of the Base64 encoding
  str = str.split('=')[0]
  // Node strips out invalid characters like \n and \t from the string, base64-js does not
  str = str.trim().replace(INVALID_BASE64_RE, '')
  // Node converts strings with length < 2 to ''
  if (str.length < 2) return ''
  // Node allows for non-padded base64 strings (missing trailing ===), base64-js does not
  while (str.length % 4 !== 0) {
    str = str + '='
  }
  return str
}

function toHex (n) {
  if (n < 16) return '0' + n.toString(16)
  return n.toString(16)
}

function utf8ToBytes (string, units) {
  units = units || Infinity
  var codePoint
  var length = string.length
  var leadSurrogate = null
  var bytes = []

  for (var i = 0; i < length; ++i) {
    codePoint = string.charCodeAt(i)

    // is surrogate component
    if (codePoint > 0xD7FF && codePoint < 0xE000) {
      // last char was a lead
      if (!leadSurrogate) {
        // no lead yet
        if (codePoint > 0xDBFF) {
          // unexpected trail
          if ((units -= 3) > -1) bytes.push(0xEF, 0xBF, 0xBD)
          continue
        } else if (i + 1 === length) {
          // unpaired lead
          if ((units -= 3) > -1) bytes.push(0xEF, 0xBF, 0xBD)
          continue
        }

        // valid lead
        leadSurrogate = codePoint

        continue
      }

      // 2 leads in a row
      if (codePoint < 0xDC00) {
        if ((units -= 3) > -1) bytes.push(0xEF, 0xBF, 0xBD)
        leadSurrogate = codePoint
        continue
      }

      // valid surrogate pair
      codePoint = (leadSurrogate - 0xD800 << 10 | codePoint - 0xDC00) + 0x10000
    } else if (leadSurrogate) {
      // valid bmp char, but last char was a lead
      if ((units -= 3) > -1) bytes.push(0xEF, 0xBF, 0xBD)
    }

    leadSurrogate = null

    // encode utf8
    if (codePoint < 0x80) {
      if ((units -= 1) < 0) break
      bytes.push(codePoint)
    } else if (codePoint < 0x800) {
      if ((units -= 2) < 0) break
      bytes.push(
        codePoint >> 0x6 | 0xC0,
        codePoint & 0x3F | 0x80
      )
    } else if (codePoint < 0x10000) {
      if ((units -= 3) < 0) break
      bytes.push(
        codePoint >> 0xC | 0xE0,
        codePoint >> 0x6 & 0x3F | 0x80,
        codePoint & 0x3F | 0x80
      )
    } else if (codePoint < 0x110000) {
      if ((units -= 4) < 0) break
      bytes.push(
        codePoint >> 0x12 | 0xF0,
        codePoint >> 0xC & 0x3F | 0x80,
        codePoint >> 0x6 & 0x3F | 0x80,
        codePoint & 0x3F | 0x80
      )
    } else {
      throw new Error('Invalid code point')
    }
  }

  return bytes
}

function asciiToBytes (str) {
  var byteArray = []
  for (var i = 0; i < str.length; ++i) {
    // Node's code seems to be doing this and not & 0x7F..
    byteArray.push(str.charCodeAt(i) & 0xFF)
  }
  return byteArray
}

function utf16leToBytes (str, units) {
  var c, hi, lo
  var byteArray = []
  for (var i = 0; i < str.length; ++i) {
    if ((units -= 2) < 0) break

    c = str.charCodeAt(i)
    hi = c >> 8
    lo = c % 256
    byteArray.push(lo)
    byteArray.push(hi)
  }

  return byteArray
}

function base64ToBytes (str) {
  return base64.toByteArray(base64clean(str))
}

function blitBuffer (src, dst, offset, length) {
  for (var i = 0; i < length; ++i) {
    if ((i + offset >= dst.length) || (i >= src.length)) break
    dst[i + offset] = src[i]
  }
  return i
}

// ArrayBuffer or Uint8Array objects from other contexts (i.e. iframes) do not pass
// the `instanceof` check but they should be treated as of that type.
// See: https://github.com/feross/buffer/issues/166
function isInstance (obj, type) {
  return obj instanceof type ||
    (obj != null && obj.constructor != null && obj.constructor.name != null &&
      obj.constructor.name === type.name)
}
function numberIsNaN (obj) {
  // For IE11 support
  return obj !== obj // eslint-disable-line no-self-compare
}

},{"base64-js":39,"ieee754":41}],41:[function(require,module,exports){
exports.read = function (buffer, offset, isLE, mLen, nBytes) {
  var e, m
  var eLen = (nBytes * 8) - mLen - 1
  var eMax = (1 << eLen) - 1
  var eBias = eMax >> 1
  var nBits = -7
  var i = isLE ? (nBytes - 1) : 0
  var d = isLE ? -1 : 1
  var s = buffer[offset + i]

  i += d

  e = s & ((1 << (-nBits)) - 1)
  s >>= (-nBits)
  nBits += eLen
  for (; nBits > 0; e = (e * 256) + buffer[offset + i], i += d, nBits -= 8) {}

  m = e & ((1 << (-nBits)) - 1)
  e >>= (-nBits)
  nBits += mLen
  for (; nBits > 0; m = (m * 256) + buffer[offset + i], i += d, nBits -= 8) {}

  if (e === 0) {
    e = 1 - eBias
  } else if (e === eMax) {
    return m ? NaN : ((s ? -1 : 1) * Infinity)
  } else {
    m = m + Math.pow(2, mLen)
    e = e - eBias
  }
  return (s ? -1 : 1) * m * Math.pow(2, e - mLen)
}

exports.write = function (buffer, value, offset, isLE, mLen, nBytes) {
  var e, m, c
  var eLen = (nBytes * 8) - mLen - 1
  var eMax = (1 << eLen) - 1
  var eBias = eMax >> 1
  var rt = (mLen === 23 ? Math.pow(2, -24) - Math.pow(2, -77) : 0)
  var i = isLE ? 0 : (nBytes - 1)
  var d = isLE ? 1 : -1
  var s = value < 0 || (value === 0 && 1 / value < 0) ? 1 : 0

  value = Math.abs(value)

  if (isNaN(value) || value === Infinity) {
    m = isNaN(value) ? 1 : 0
    e = eMax
  } else {
    e = Math.floor(Math.log(value) / Math.LN2)
    if (value * (c = Math.pow(2, -e)) < 1) {
      e--
      c *= 2
    }
    if (e + eBias >= 1) {
      value += rt / c
    } else {
      value += rt * Math.pow(2, 1 - eBias)
    }
    if (value * c >= 2) {
      e++
      c /= 2
    }

    if (e + eBias >= eMax) {
      m = 0
      e = eMax
    } else if (e + eBias >= 1) {
      m = ((value * c) - 1) * Math.pow(2, mLen)
      e = e + eBias
    } else {
      m = value * Math.pow(2, eBias - 1) * Math.pow(2, mLen)
      e = 0
    }
  }

  for (; mLen >= 8; buffer[offset + i] = m & 0xff, i += d, m /= 256, mLen -= 8) {}

  e = (e << mLen) | m
  eLen += mLen
  for (; eLen > 0; buffer[offset + i] = e & 0xff, i += d, e /= 256, eLen -= 8) {}

  buffer[offset + i - d] |= s * 128
}

},{}],42:[function(require,module,exports){
if (typeof Object.create === 'function') {
  // implementation from standard node.js 'util' module
  module.exports = function inherits(ctor, superCtor) {
    ctor.super_ = superCtor
    ctor.prototype = Object.create(superCtor.prototype, {
      constructor: {
        value: ctor,
        enumerable: false,
        writable: true,
        configurable: true
      }
    });
  };
} else {
  // old school shim for old browsers
  module.exports = function inherits(ctor, superCtor) {
    ctor.super_ = superCtor
    var TempCtor = function () {}
    TempCtor.prototype = superCtor.prototype
    ctor.prototype = new TempCtor()
    ctor.prototype.constructor = ctor
  }
}

},{}],43:[function(require,module,exports){
/*!
 * Determine if an object is a Buffer
 *
 * @author   Feross Aboukhadijeh <https://feross.org>
 * @license  MIT
 */

// The _isBuffer check is for Safari 5-7 support, because it's missing
// Object.prototype.constructor. Remove this eventually
module.exports = function (obj) {
  return obj != null && (isBuffer(obj) || isSlowBuffer(obj) || !!obj._isBuffer)
}

function isBuffer (obj) {
  return !!obj.constructor && typeof obj.constructor.isBuffer === 'function' && obj.constructor.isBuffer(obj)
}

// For Node v0.10 support. Remove this eventually.
function isSlowBuffer (obj) {
  return typeof obj.readFloatLE === 'function' && typeof obj.slice === 'function' && isBuffer(obj.slice(0, 0))
}

},{}],44:[function(require,module,exports){
exports.endianness = function () { return 'LE' };

exports.hostname = function () {
    if (typeof location !== 'undefined') {
        return location.hostname
    }
    else return '';
};

exports.loadavg = function () { return [] };

exports.uptime = function () { return 0 };

exports.freemem = function () {
    return Number.MAX_VALUE;
};

exports.totalmem = function () {
    return Number.MAX_VALUE;
};

exports.cpus = function () { return [] };

exports.type = function () { return 'Browser' };

exports.release = function () {
    if (typeof navigator !== 'undefined') {
        return navigator.appVersion;
    }
    return '';
};

exports.networkInterfaces
= exports.getNetworkInterfaces
= function () { return {} };

exports.arch = function () { return 'javascript' };

exports.platform = function () { return 'browser' };

exports.tmpdir = exports.tmpDir = function () {
    return '/tmp';
};

exports.EOL = '\n';

exports.homedir = function () {
	return '/'
};

},{}],45:[function(require,module,exports){
(function (process){
// .dirname, .basename, and .extname methods are extracted from Node.js v8.11.1,
// backported and transplited with Babel, with backwards-compat fixes

// Copyright Joyent, Inc. and other Node contributors.
//
// Permission is hereby granted, free of charge, to any person obtaining a
// copy of this software and associated documentation files (the
// "Software"), to deal in the Software without restriction, including
// without limitation the rights to use, copy, modify, merge, publish,
// distribute, sublicense, and/or sell copies of the Software, and to permit
// persons to whom the Software is furnished to do so, subject to the
// following conditions:
//
// The above copyright notice and this permission notice shall be included
// in all copies or substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS
// OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
// MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN
// NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM,
// DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR
// OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE
// USE OR OTHER DEALINGS IN THE SOFTWARE.

// resolves . and .. elements in a path array with directory names there
// must be no slashes, empty elements, or device names (c:\) in the array
// (so also no leading and trailing slashes - it does not distinguish
// relative and absolute paths)
function normalizeArray(parts, allowAboveRoot) {
  // if the path tries to go above the root, `up` ends up > 0
  var up = 0;
  for (var i = parts.length - 1; i >= 0; i--) {
    var last = parts[i];
    if (last === '.') {
      parts.splice(i, 1);
    } else if (last === '..') {
      parts.splice(i, 1);
      up++;
    } else if (up) {
      parts.splice(i, 1);
      up--;
    }
  }

  // if the path is allowed to go above the root, restore leading ..s
  if (allowAboveRoot) {
    for (; up--; up) {
      parts.unshift('..');
    }
  }

  return parts;
}

// path.resolve([from ...], to)
// posix version
exports.resolve = function() {
  var resolvedPath = '',
      resolvedAbsolute = false;

  for (var i = arguments.length - 1; i >= -1 && !resolvedAbsolute; i--) {
    var path = (i >= 0) ? arguments[i] : process.cwd();

    // Skip empty and invalid entries
    if (typeof path !== 'string') {
      throw new TypeError('Arguments to path.resolve must be strings');
    } else if (!path) {
      continue;
    }

    resolvedPath = path + '/' + resolvedPath;
    resolvedAbsolute = path.charAt(0) === '/';
  }

  // At this point the path should be resolved to a full absolute path, but
  // handle relative paths to be safe (might happen when process.cwd() fails)

  // Normalize the path
  resolvedPath = normalizeArray(filter(resolvedPath.split('/'), function(p) {
    return !!p;
  }), !resolvedAbsolute).join('/');

  return ((resolvedAbsolute ? '/' : '') + resolvedPath) || '.';
};

// path.normalize(path)
// posix version
exports.normalize = function(path) {
  var isAbsolute = exports.isAbsolute(path),
      trailingSlash = substr(path, -1) === '/';

  // Normalize the path
  path = normalizeArray(filter(path.split('/'), function(p) {
    return !!p;
  }), !isAbsolute).join('/');

  if (!path && !isAbsolute) {
    path = '.';
  }
  if (path && trailingSlash) {
    path += '/';
  }

  return (isAbsolute ? '/' : '') + path;
};

// posix version
exports.isAbsolute = function(path) {
  return path.charAt(0) === '/';
};

// posix version
exports.join = function() {
  var paths = Array.prototype.slice.call(arguments, 0);
  return exports.normalize(filter(paths, function(p, index) {
    if (typeof p !== 'string') {
      throw new TypeError('Arguments to path.join must be strings');
    }
    return p;
  }).join('/'));
};


// path.relative(from, to)
// posix version
exports.relative = function(from, to) {
  from = exports.resolve(from).substr(1);
  to = exports.resolve(to).substr(1);

  function trim(arr) {
    var start = 0;
    for (; start < arr.length; start++) {
      if (arr[start] !== '') break;
    }

    var end = arr.length - 1;
    for (; end >= 0; end--) {
      if (arr[end] !== '') break;
    }

    if (start > end) return [];
    return arr.slice(start, end - start + 1);
  }

  var fromParts = trim(from.split('/'));
  var toParts = trim(to.split('/'));

  var length = Math.min(fromParts.length, toParts.length);
  var samePartsLength = length;
  for (var i = 0; i < length; i++) {
    if (fromParts[i] !== toParts[i]) {
      samePartsLength = i;
      break;
    }
  }

  var outputParts = [];
  for (var i = samePartsLength; i < fromParts.length; i++) {
    outputParts.push('..');
  }

  outputParts = outputParts.concat(toParts.slice(samePartsLength));

  return outputParts.join('/');
};

exports.sep = '/';
exports.delimiter = ':';

exports.dirname = function (path) {
  if (typeof path !== 'string') path = path + '';
  if (path.length === 0) return '.';
  var code = path.charCodeAt(0);
  var hasRoot = code === 47 /*/*/;
  var end = -1;
  var matchedSlash = true;
  for (var i = path.length - 1; i >= 1; --i) {
    code = path.charCodeAt(i);
    if (code === 47 /*/*/) {
        if (!matchedSlash) {
          end = i;
          break;
        }
      } else {
      // We saw the first non-path separator
      matchedSlash = false;
    }
  }

  if (end === -1) return hasRoot ? '/' : '.';
  if (hasRoot && end === 1) {
    // return '//';
    // Backwards-compat fix:
    return '/';
  }
  return path.slice(0, end);
};

function basename(path) {
  if (typeof path !== 'string') path = path + '';

  var start = 0;
  var end = -1;
  var matchedSlash = true;
  var i;

  for (i = path.length - 1; i >= 0; --i) {
    if (path.charCodeAt(i) === 47 /*/*/) {
        // If we reached a path separator that was not part of a set of path
        // separators at the end of the string, stop now
        if (!matchedSlash) {
          start = i + 1;
          break;
        }
      } else if (end === -1) {
      // We saw the first non-path separator, mark this as the end of our
      // path component
      matchedSlash = false;
      end = i + 1;
    }
  }

  if (end === -1) return '';
  return path.slice(start, end);
}

// Uses a mixed approach for backwards-compatibility, as ext behavior changed
// in new Node.js versions, so only basename() above is backported here
exports.basename = function (path, ext) {
  var f = basename(path);
  if (ext && f.substr(-1 * ext.length) === ext) {
    f = f.substr(0, f.length - ext.length);
  }
  return f;
};

exports.extname = function (path) {
  if (typeof path !== 'string') path = path + '';
  var startDot = -1;
  var startPart = 0;
  var end = -1;
  var matchedSlash = true;
  // Track the state of characters (if any) we see before our first dot and
  // after any path separator we find
  var preDotState = 0;
  for (var i = path.length - 1; i >= 0; --i) {
    var code = path.charCodeAt(i);
    if (code === 47 /*/*/) {
        // If we reached a path separator that was not part of a set of path
        // separators at the end of the string, stop now
        if (!matchedSlash) {
          startPart = i + 1;
          break;
        }
        continue;
      }
    if (end === -1) {
      // We saw the first non-path separator, mark this as the end of our
      // extension
      matchedSlash = false;
      end = i + 1;
    }
    if (code === 46 /*.*/) {
        // If this is our first dot, mark it as the start of our extension
        if (startDot === -1)
          startDot = i;
        else if (preDotState !== 1)
          preDotState = 1;
    } else if (startDot !== -1) {
      // We saw a non-dot and non-path separator before our dot, so we should
      // have a good chance at having a non-empty extension
      preDotState = -1;
    }
  }

  if (startDot === -1 || end === -1 ||
      // We saw a non-dot character immediately before the dot
      preDotState === 0 ||
      // The (right-most) trimmed path component is exactly '..'
      preDotState === 1 && startDot === end - 1 && startDot === startPart + 1) {
    return '';
  }
  return path.slice(startDot, end);
};

function filter (xs, f) {
    if (xs.filter) return xs.filter(f);
    var res = [];
    for (var i = 0; i < xs.length; i++) {
        if (f(xs[i], i, xs)) res.push(xs[i]);
    }
    return res;
}

// String.prototype.substr - negative index don't work in IE8
var substr = 'ab'.substr(-1) === 'b'
    ? function (str, start, len) { return str.substr(start, len) }
    : function (str, start, len) {
        if (start < 0) start = str.length + start;
        return str.substr(start, len);
    }
;

}).call(this,require('_process'))
},{"_process":46}],46:[function(require,module,exports){
// shim for using process in browser
var process = module.exports = {};

// cached from whatever global is present so that test runners that stub it
// don't break things.  But we need to wrap it in a try catch in case it is
// wrapped in strict mode code which doesn't define any globals.  It's inside a
// function because try/catches deoptimize in certain engines.

var cachedSetTimeout;
var cachedClearTimeout;

function defaultSetTimout() {
    throw new Error('setTimeout has not been defined');
}
function defaultClearTimeout () {
    throw new Error('clearTimeout has not been defined');
}
(function () {
    try {
        if (typeof setTimeout === 'function') {
            cachedSetTimeout = setTimeout;
        } else {
            cachedSetTimeout = defaultSetTimout;
        }
    } catch (e) {
        cachedSetTimeout = defaultSetTimout;
    }
    try {
        if (typeof clearTimeout === 'function') {
            cachedClearTimeout = clearTimeout;
        } else {
            cachedClearTimeout = defaultClearTimeout;
        }
    } catch (e) {
        cachedClearTimeout = defaultClearTimeout;
    }
} ())
function runTimeout(fun) {
    if (cachedSetTimeout === setTimeout) {
        //normal enviroments in sane situations
        return setTimeout(fun, 0);
    }
    // if setTimeout wasn't available but was latter defined
    if ((cachedSetTimeout === defaultSetTimout || !cachedSetTimeout) && setTimeout) {
        cachedSetTimeout = setTimeout;
        return setTimeout(fun, 0);
    }
    try {
        // when when somebody has screwed with setTimeout but no I.E. maddness
        return cachedSetTimeout(fun, 0);
    } catch(e){
        try {
            // When we are in I.E. but the script has been evaled so I.E. doesn't trust the global object when called normally
            return cachedSetTimeout.call(null, fun, 0);
        } catch(e){
            // same as above but when it's a version of I.E. that must have the global object for 'this', hopfully our context correct otherwise it will throw a global error
            return cachedSetTimeout.call(this, fun, 0);
        }
    }


}
function runClearTimeout(marker) {
    if (cachedClearTimeout === clearTimeout) {
        //normal enviroments in sane situations
        return clearTimeout(marker);
    }
    // if clearTimeout wasn't available but was latter defined
    if ((cachedClearTimeout === defaultClearTimeout || !cachedClearTimeout) && clearTimeout) {
        cachedClearTimeout = clearTimeout;
        return clearTimeout(marker);
    }
    try {
        // when when somebody has screwed with setTimeout but no I.E. maddness
        return cachedClearTimeout(marker);
    } catch (e){
        try {
            // When we are in I.E. but the script has been evaled so I.E. doesn't  trust the global object when called normally
            return cachedClearTimeout.call(null, marker);
        } catch (e){
            // same as above but when it's a version of I.E. that must have the global object for 'this', hopfully our context correct otherwise it will throw a global error.
            // Some versions of I.E. have different rules for clearTimeout vs setTimeout
            return cachedClearTimeout.call(this, marker);
        }
    }



}
var queue = [];
var draining = false;
var currentQueue;
var queueIndex = -1;

function cleanUpNextTick() {
    if (!draining || !currentQueue) {
        return;
    }
    draining = false;
    if (currentQueue.length) {
        queue = currentQueue.concat(queue);
    } else {
        queueIndex = -1;
    }
    if (queue.length) {
        drainQueue();
    }
}

function drainQueue() {
    if (draining) {
        return;
    }
    var timeout = runTimeout(cleanUpNextTick);
    draining = true;

    var len = queue.length;
    while(len) {
        currentQueue = queue;
        queue = [];
        while (++queueIndex < len) {
            if (currentQueue) {
                currentQueue[queueIndex].run();
            }
        }
        queueIndex = -1;
        len = queue.length;
    }
    currentQueue = null;
    draining = false;
    runClearTimeout(timeout);
}

process.nextTick = function (fun) {
    var args = new Array(arguments.length - 1);
    if (arguments.length > 1) {
        for (var i = 1; i < arguments.length; i++) {
            args[i - 1] = arguments[i];
        }
    }
    queue.push(new Item(fun, args));
    if (queue.length === 1 && !draining) {
        runTimeout(drainQueue);
    }
};

// v8 likes predictible objects
function Item(fun, array) {
    this.fun = fun;
    this.array = array;
}
Item.prototype.run = function () {
    this.fun.apply(null, this.array);
};
process.title = 'browser';
process.browser = true;
process.env = {};
process.argv = [];
process.version = ''; // empty string to avoid regexp issues
process.versions = {};

function noop() {}

process.on = noop;
process.addListener = noop;
process.once = noop;
process.off = noop;
process.removeListener = noop;
process.removeAllListeners = noop;
process.emit = noop;
process.prependListener = noop;
process.prependOnceListener = noop;

process.listeners = function (name) { return [] }

process.binding = function (name) {
    throw new Error('process.binding is not supported');
};

process.cwd = function () { return '/' };
process.chdir = function (dir) {
    throw new Error('process.chdir is not supported');
};
process.umask = function() { return 0; };

},{}],47:[function(require,module,exports){
(function (setImmediate,clearImmediate){
var nextTick = require('process/browser.js').nextTick;
var apply = Function.prototype.apply;
var slice = Array.prototype.slice;
var immediateIds = {};
var nextImmediateId = 0;

// DOM APIs, for completeness

exports.setTimeout = function() {
  return new Timeout(apply.call(setTimeout, window, arguments), clearTimeout);
};
exports.setInterval = function() {
  return new Timeout(apply.call(setInterval, window, arguments), clearInterval);
};
exports.clearTimeout =
exports.clearInterval = function(timeout) { timeout.close(); };

function Timeout(id, clearFn) {
  this._id = id;
  this._clearFn = clearFn;
}
Timeout.prototype.unref = Timeout.prototype.ref = function() {};
Timeout.prototype.close = function() {
  this._clearFn.call(window, this._id);
};

// Does not start the time, just sets up the members needed.
exports.enroll = function(item, msecs) {
  clearTimeout(item._idleTimeoutId);
  item._idleTimeout = msecs;
};

exports.unenroll = function(item) {
  clearTimeout(item._idleTimeoutId);
  item._idleTimeout = -1;
};

exports._unrefActive = exports.active = function(item) {
  clearTimeout(item._idleTimeoutId);

  var msecs = item._idleTimeout;
  if (msecs >= 0) {
    item._idleTimeoutId = setTimeout(function onTimeout() {
      if (item._onTimeout)
        item._onTimeout();
    }, msecs);
  }
};

// That's not how node.js implements it but the exposed api is the same.
exports.setImmediate = typeof setImmediate === "function" ? setImmediate : function(fn) {
  var id = nextImmediateId++;
  var args = arguments.length < 2 ? false : slice.call(arguments, 1);

  immediateIds[id] = true;

  nextTick(function onNextTick() {
    if (immediateIds[id]) {
      // fn.call() is faster so we optimize for the common use-case
      // @see http://jsperf.com/call-apply-segu
      if (args) {
        fn.apply(null, args);
      } else {
        fn.call(null);
      }
      // Prevent ids from leaking
      exports.clearImmediate(id);
    }
  });

  return id;
};

exports.clearImmediate = typeof clearImmediate === "function" ? clearImmediate : function(id) {
  delete immediateIds[id];
};
}).call(this,require("timers").setImmediate,require("timers").clearImmediate)
},{"process/browser.js":46,"timers":47}],48:[function(require,module,exports){
module.exports = function isBuffer(arg) {
  return arg && typeof arg === 'object'
    && typeof arg.copy === 'function'
    && typeof arg.fill === 'function'
    && typeof arg.readUInt8 === 'function';
}
},{}],49:[function(require,module,exports){
(function (process,global){
// Copyright Joyent, Inc. and other Node contributors.
//
// Permission is hereby granted, free of charge, to any person obtaining a
// copy of this software and associated documentation files (the
// "Software"), to deal in the Software without restriction, including
// without limitation the rights to use, copy, modify, merge, publish,
// distribute, sublicense, and/or sell copies of the Software, and to permit
// persons to whom the Software is furnished to do so, subject to the
// following conditions:
//
// The above copyright notice and this permission notice shall be included
// in all copies or substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS
// OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
// MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN
// NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM,
// DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR
// OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE
// USE OR OTHER DEALINGS IN THE SOFTWARE.

var formatRegExp = /%[sdj%]/g;
exports.format = function(f) {
  if (!isString(f)) {
    var objects = [];
    for (var i = 0; i < arguments.length; i++) {
      objects.push(inspect(arguments[i]));
    }
    return objects.join(' ');
  }

  var i = 1;
  var args = arguments;
  var len = args.length;
  var str = String(f).replace(formatRegExp, function(x) {
    if (x === '%%') return '%';
    if (i >= len) return x;
    switch (x) {
      case '%s': return String(args[i++]);
      case '%d': return Number(args[i++]);
      case '%j':
        try {
          return JSON.stringify(args[i++]);
        } catch (_) {
          return '[Circular]';
        }
      default:
        return x;
    }
  });
  for (var x = args[i]; i < len; x = args[++i]) {
    if (isNull(x) || !isObject(x)) {
      str += ' ' + x;
    } else {
      str += ' ' + inspect(x);
    }
  }
  return str;
};


// Mark that a method should not be used.
// Returns a modified function which warns once by default.
// If --no-deprecation is set, then it is a no-op.
exports.deprecate = function(fn, msg) {
  // Allow for deprecating things in the process of starting up.
  if (isUndefined(global.process)) {
    return function() {
      return exports.deprecate(fn, msg).apply(this, arguments);
    };
  }

  if (process.noDeprecation === true) {
    return fn;
  }

  var warned = false;
  function deprecated() {
    if (!warned) {
      if (process.throwDeprecation) {
        throw new Error(msg);
      } else if (process.traceDeprecation) {
        console.trace(msg);
      } else {
        console.error(msg);
      }
      warned = true;
    }
    return fn.apply(this, arguments);
  }

  return deprecated;
};


var debugs = {};
var debugEnviron;
exports.debuglog = function(set) {
  if (isUndefined(debugEnviron))
    debugEnviron = process.env.NODE_DEBUG || '';
  set = set.toUpperCase();
  if (!debugs[set]) {
    if (new RegExp('\\b' + set + '\\b', 'i').test(debugEnviron)) {
      var pid = process.pid;
      debugs[set] = function() {
        var msg = exports.format.apply(exports, arguments);
        console.error('%s %d: %s', set, pid, msg);
      };
    } else {
      debugs[set] = function() {};
    }
  }
  return debugs[set];
};


/**
 * Echos the value of a value. Trys to print the value out
 * in the best way possible given the different types.
 *
 * @param {Object} obj The object to print out.
 * @param {Object} opts Optional options object that alters the output.
 */
/* legacy: obj, showHidden, depth, colors*/
function inspect(obj, opts) {
  // default options
  var ctx = {
    seen: [],
    stylize: stylizeNoColor
  };
  // legacy...
  if (arguments.length >= 3) ctx.depth = arguments[2];
  if (arguments.length >= 4) ctx.colors = arguments[3];
  if (isBoolean(opts)) {
    // legacy...
    ctx.showHidden = opts;
  } else if (opts) {
    // got an "options" object
    exports._extend(ctx, opts);
  }
  // set default options
  if (isUndefined(ctx.showHidden)) ctx.showHidden = false;
  if (isUndefined(ctx.depth)) ctx.depth = 2;
  if (isUndefined(ctx.colors)) ctx.colors = false;
  if (isUndefined(ctx.customInspect)) ctx.customInspect = true;
  if (ctx.colors) ctx.stylize = stylizeWithColor;
  return formatValue(ctx, obj, ctx.depth);
}
exports.inspect = inspect;


// http://en.wikipedia.org/wiki/ANSI_escape_code#graphics
inspect.colors = {
  'bold' : [1, 22],
  'italic' : [3, 23],
  'underline' : [4, 24],
  'inverse' : [7, 27],
  'white' : [37, 39],
  'grey' : [90, 39],
  'black' : [30, 39],
  'blue' : [34, 39],
  'cyan' : [36, 39],
  'green' : [32, 39],
  'magenta' : [35, 39],
  'red' : [31, 39],
  'yellow' : [33, 39]
};

// Don't use 'blue' not visible on cmd.exe
inspect.styles = {
  'special': 'cyan',
  'number': 'yellow',
  'boolean': 'yellow',
  'undefined': 'grey',
  'null': 'bold',
  'string': 'green',
  'date': 'magenta',
  // "name": intentionally not styling
  'regexp': 'red'
};


function stylizeWithColor(str, styleType) {
  var style = inspect.styles[styleType];

  if (style) {
    return '\u001b[' + inspect.colors[style][0] + 'm' + str +
           '\u001b[' + inspect.colors[style][1] + 'm';
  } else {
    return str;
  }
}


function stylizeNoColor(str, styleType) {
  return str;
}


function arrayToHash(array) {
  var hash = {};

  array.forEach(function(val, idx) {
    hash[val] = true;
  });

  return hash;
}


function formatValue(ctx, value, recurseTimes) {
  // Provide a hook for user-specified inspect functions.
  // Check that value is an object with an inspect function on it
  if (ctx.customInspect &&
      value &&
      isFunction(value.inspect) &&
      // Filter out the util module, it's inspect function is special
      value.inspect !== exports.inspect &&
      // Also filter out any prototype objects using the circular check.
      !(value.constructor && value.constructor.prototype === value)) {
    var ret = value.inspect(recurseTimes, ctx);
    if (!isString(ret)) {
      ret = formatValue(ctx, ret, recurseTimes);
    }
    return ret;
  }

  // Primitive types cannot have properties
  var primitive = formatPrimitive(ctx, value);
  if (primitive) {
    return primitive;
  }

  // Look up the keys of the object.
  var keys = Object.keys(value);
  var visibleKeys = arrayToHash(keys);

  if (ctx.showHidden) {
    keys = Object.getOwnPropertyNames(value);
  }

  // IE doesn't make error fields non-enumerable
  // http://msdn.microsoft.com/en-us/library/ie/dww52sbt(v=vs.94).aspx
  if (isError(value)
      && (keys.indexOf('message') >= 0 || keys.indexOf('description') >= 0)) {
    return formatError(value);
  }

  // Some type of object without properties can be shortcutted.
  if (keys.length === 0) {
    if (isFunction(value)) {
      var name = value.name ? ': ' + value.name : '';
      return ctx.stylize('[Function' + name + ']', 'special');
    }
    if (isRegExp(value)) {
      return ctx.stylize(RegExp.prototype.toString.call(value), 'regexp');
    }
    if (isDate(value)) {
      return ctx.stylize(Date.prototype.toString.call(value), 'date');
    }
    if (isError(value)) {
      return formatError(value);
    }
  }

  var base = '', array = false, braces = ['{', '}'];

  // Make Array say that they are Array
  if (isArray(value)) {
    array = true;
    braces = ['[', ']'];
  }

  // Make functions say that they are functions
  if (isFunction(value)) {
    var n = value.name ? ': ' + value.name : '';
    base = ' [Function' + n + ']';
  }

  // Make RegExps say that they are RegExps
  if (isRegExp(value)) {
    base = ' ' + RegExp.prototype.toString.call(value);
  }

  // Make dates with properties first say the date
  if (isDate(value)) {
    base = ' ' + Date.prototype.toUTCString.call(value);
  }

  // Make error with message first say the error
  if (isError(value)) {
    base = ' ' + formatError(value);
  }

  if (keys.length === 0 && (!array || value.length == 0)) {
    return braces[0] + base + braces[1];
  }

  if (recurseTimes < 0) {
    if (isRegExp(value)) {
      return ctx.stylize(RegExp.prototype.toString.call(value), 'regexp');
    } else {
      return ctx.stylize('[Object]', 'special');
    }
  }

  ctx.seen.push(value);

  var output;
  if (array) {
    output = formatArray(ctx, value, recurseTimes, visibleKeys, keys);
  } else {
    output = keys.map(function(key) {
      return formatProperty(ctx, value, recurseTimes, visibleKeys, key, array);
    });
  }

  ctx.seen.pop();

  return reduceToSingleString(output, base, braces);
}


function formatPrimitive(ctx, value) {
  if (isUndefined(value))
    return ctx.stylize('undefined', 'undefined');
  if (isString(value)) {
    var simple = '\'' + JSON.stringify(value).replace(/^"|"$/g, '')
                                             .replace(/'/g, "\\'")
                                             .replace(/\\"/g, '"') + '\'';
    return ctx.stylize(simple, 'string');
  }
  if (isNumber(value))
    return ctx.stylize('' + value, 'number');
  if (isBoolean(value))
    return ctx.stylize('' + value, 'boolean');
  // For some reason typeof null is "object", so special case here.
  if (isNull(value))
    return ctx.stylize('null', 'null');
}


function formatError(value) {
  return '[' + Error.prototype.toString.call(value) + ']';
}


function formatArray(ctx, value, recurseTimes, visibleKeys, keys) {
  var output = [];
  for (var i = 0, l = value.length; i < l; ++i) {
    if (hasOwnProperty(value, String(i))) {
      output.push(formatProperty(ctx, value, recurseTimes, visibleKeys,
          String(i), true));
    } else {
      output.push('');
    }
  }
  keys.forEach(function(key) {
    if (!key.match(/^\d+$/)) {
      output.push(formatProperty(ctx, value, recurseTimes, visibleKeys,
          key, true));
    }
  });
  return output;
}


function formatProperty(ctx, value, recurseTimes, visibleKeys, key, array) {
  var name, str, desc;
  desc = Object.getOwnPropertyDescriptor(value, key) || { value: value[key] };
  if (desc.get) {
    if (desc.set) {
      str = ctx.stylize('[Getter/Setter]', 'special');
    } else {
      str = ctx.stylize('[Getter]', 'special');
    }
  } else {
    if (desc.set) {
      str = ctx.stylize('[Setter]', 'special');
    }
  }
  if (!hasOwnProperty(visibleKeys, key)) {
    name = '[' + key + ']';
  }
  if (!str) {
    if (ctx.seen.indexOf(desc.value) < 0) {
      if (isNull(recurseTimes)) {
        str = formatValue(ctx, desc.value, null);
      } else {
        str = formatValue(ctx, desc.value, recurseTimes - 1);
      }
      if (str.indexOf('\n') > -1) {
        if (array) {
          str = str.split('\n').map(function(line) {
            return '  ' + line;
          }).join('\n').substr(2);
        } else {
          str = '\n' + str.split('\n').map(function(line) {
            return '   ' + line;
          }).join('\n');
        }
      }
    } else {
      str = ctx.stylize('[Circular]', 'special');
    }
  }
  if (isUndefined(name)) {
    if (array && key.match(/^\d+$/)) {
      return str;
    }
    name = JSON.stringify('' + key);
    if (name.match(/^"([a-zA-Z_][a-zA-Z_0-9]*)"$/)) {
      name = name.substr(1, name.length - 2);
      name = ctx.stylize(name, 'name');
    } else {
      name = name.replace(/'/g, "\\'")
                 .replace(/\\"/g, '"')
                 .replace(/(^"|"$)/g, "'");
      name = ctx.stylize(name, 'string');
    }
  }

  return name + ': ' + str;
}


function reduceToSingleString(output, base, braces) {
  var numLinesEst = 0;
  var length = output.reduce(function(prev, cur) {
    numLinesEst++;
    if (cur.indexOf('\n') >= 0) numLinesEst++;
    return prev + cur.replace(/\u001b\[\d\d?m/g, '').length + 1;
  }, 0);

  if (length > 60) {
    return braces[0] +
           (base === '' ? '' : base + '\n ') +
           ' ' +
           output.join(',\n  ') +
           ' ' +
           braces[1];
  }

  return braces[0] + base + ' ' + output.join(', ') + ' ' + braces[1];
}


// NOTE: These type checking functions intentionally don't use `instanceof`
// because it is fragile and can be easily faked with `Object.create()`.
function isArray(ar) {
  return Array.isArray(ar);
}
exports.isArray = isArray;

function isBoolean(arg) {
  return typeof arg === 'boolean';
}
exports.isBoolean = isBoolean;

function isNull(arg) {
  return arg === null;
}
exports.isNull = isNull;

function isNullOrUndefined(arg) {
  return arg == null;
}
exports.isNullOrUndefined = isNullOrUndefined;

function isNumber(arg) {
  return typeof arg === 'number';
}
exports.isNumber = isNumber;

function isString(arg) {
  return typeof arg === 'string';
}
exports.isString = isString;

function isSymbol(arg) {
  return typeof arg === 'symbol';
}
exports.isSymbol = isSymbol;

function isUndefined(arg) {
  return arg === void 0;
}
exports.isUndefined = isUndefined;

function isRegExp(re) {
  return isObject(re) && objectToString(re) === '[object RegExp]';
}
exports.isRegExp = isRegExp;

function isObject(arg) {
  return typeof arg === 'object' && arg !== null;
}
exports.isObject = isObject;

function isDate(d) {
  return isObject(d) && objectToString(d) === '[object Date]';
}
exports.isDate = isDate;

function isError(e) {
  return isObject(e) &&
      (objectToString(e) === '[object Error]' || e instanceof Error);
}
exports.isError = isError;

function isFunction(arg) {
  return typeof arg === 'function';
}
exports.isFunction = isFunction;

function isPrimitive(arg) {
  return arg === null ||
         typeof arg === 'boolean' ||
         typeof arg === 'number' ||
         typeof arg === 'string' ||
         typeof arg === 'symbol' ||  // ES6 symbol
         typeof arg === 'undefined';
}
exports.isPrimitive = isPrimitive;

exports.isBuffer = require('./support/isBuffer');

function objectToString(o) {
  return Object.prototype.toString.call(o);
}


function pad(n) {
  return n < 10 ? '0' + n.toString(10) : n.toString(10);
}


var months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep',
              'Oct', 'Nov', 'Dec'];

// 26 Feb 16:19:34
function timestamp() {
  var d = new Date();
  var time = [pad(d.getHours()),
              pad(d.getMinutes()),
              pad(d.getSeconds())].join(':');
  return [d.getDate(), months[d.getMonth()], time].join(' ');
}


// log is just a thin wrapper to console.log that prepends a timestamp
exports.log = function() {
  console.log('%s - %s', timestamp(), exports.format.apply(exports, arguments));
};


/**
 * Inherit the prototype methods from one constructor into another.
 *
 * The Function.prototype.inherits from lang.js rewritten as a standalone
 * function (not on Function.prototype). NOTE: If this file is to be loaded
 * during bootstrapping this function needs to be rewritten using some native
 * functions as prototype setup using normal JavaScript does not work as
 * expected during bootstrapping (see mirror.js in r114903).
 *
 * @param {function} ctor Constructor function which needs to inherit the
 *     prototype.
 * @param {function} superCtor Constructor function to inherit prototype from.
 */
exports.inherits = require('inherits');

exports._extend = function(origin, add) {
  // Don't do anything if add isn't an object
  if (!add || !isObject(add)) return origin;

  var keys = Object.keys(add);
  var i = keys.length;
  while (i--) {
    origin[keys[i]] = add[keys[i]];
  }
  return origin;
};

function hasOwnProperty(obj, prop) {
  return Object.prototype.hasOwnProperty.call(obj, prop);
}

}).call(this,require('_process'),typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})
},{"./support/isBuffer":48,"_process":46,"inherits":42}]},{},[2])(2)
});
