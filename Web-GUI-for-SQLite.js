const Structure = Object.freeze({
	TABLE:   "table",
	VIEW:  "view",
	INDEX: "index",
	SEQUENCE: "sequence"
});
var ReadModeEnum = {
  TEXT: 1,
  ARRAY_BUFFER: 2,
  DATA_URL: 3
};
class SQLiteWebJS {
	constructor() {
		this.dialogTable = null;
		this.dialogData = null;
		this.db = null;
		this.messages = null;
		this.myCodeMirror = null;
		this.currentStructure = null;
		this.currentQuery = null;
	}
	createDatabase () {
		this.db = new SQL.Database();
	}
	loadStream (stream) {
		this.db = new SQL.Database(new Uint8Array(stream));
	}
	execute (query, header) {
		if (!this.db) {
			this.createDatabase();
		}
		if (!header) {
			var rows = [];
			try {
				this.db.each(query, {}, function(row){ rows.push(row); });
			}
			catch (e) {
				return new Error(e.message);
			}
			return rows;
		} else {
			var result = null;
			var resultObject = {columns: []};
			try {
				result = this.db.exec(query);
			}
			catch (e) {
				return new Error(e.message);
			}
			resultObject.rows = [];
			if (result.length) {
				resultObject.columns = result[0].columns;
				if (result[0].values) {
					result[0].values.forEach(function (value) {
						var row = {};
						resultObject.columns.forEach(function (column, index) {
							row[column] = value[index];
						});
						resultObject.rows.push(row);
					});
				}
			}
			return resultObject;
		}
	}
	tables () {
		if (!this.db) {
			this.createDatabase();
		}
		var tables = [];
		this.db.each("SELECT name, sql FROM sqlite_master WHERE type='table' ", {}, function(row){ tables.push(row); });
		return tables;
	}
	setMessage(type, message) {
		while (this.message.classList.length > 0) {
		   this.message.classList.remove(this.message.classList.item(0));
		}
		this.message.classList.add(type);
		this.message.innerText = message;
		this.message.style.display = '';
	}
	resetMessage() {
		while (this.message.classList.length > 0) {
		   this.message.classList.remove(this.message.classList.item(0));
		}
		this.message.innerText = '';
		this.message.style.display = 'none';
	}
	openSQLite() {
		document.getElementById('file-input').click();
	}
	selectCSVFile() {
		document.getElementById('csv-file-input').click();
	}
	exportFile(fileObject) {
		var blob = (fileObject.blob ? fileObject.blob : new Blob([fileObject.data], { type: fileObject.mime }));
		if (navigator.msSaveBlob) { // IE 10+
			navigator.msSaveBlob(blob, fileObject.filename);
		} else {
			var link = document.createElement("a");
			if (link.download !== undefined) { // feature detection
				// Browsers that support HTML5 download attribute
				var url = URL.createObjectURL(blob);
				link.setAttribute("href", url);
				link.setAttribute("download", fileObject.filename);
				link.style.visibility = 'hidden';
				document.body.appendChild(link);
				link.click();
				document.body.removeChild(link);
			}
		}
	}
	exportDatabaseFile() {
		if (!this.db) {
			this.createDatabase();
		}
		var uint8Array = this.db.export();
		var fileInput = document.getElementById('file-input').value;
		var filename = function(fullPath) {
			var filename = '';
			if (fullPath) {
				var startIndex = (fullPath.indexOf('\\') >= 0 ? fullPath.lastIndexOf('\\') : fullPath.lastIndexOf('/'));
				filename = fullPath.substring(startIndex);
				if (filename.indexOf('\\') === 0 || filename.indexOf('/') === 0) {
					filename = filename.substring(1);
				}
			}
			return filename;
		}
		this.exportFile({data: uint8Array, filename: fileInput ? filename(fileInput) : "file.sqli", mime: 'application/octet-stream'}); 
	}
	getColumns(tableName) {
		var rows = this.execute("PRAGMA table_info(" + tableName + ")");
		if (rows instanceof Error) {
			return null;
		}
		return rows;
	}
	getTableInfo(tableName) {
		var tableData = {type: Structure.TABLE, name: tableName, columns: this.getColumns(tableName), pk: null, query: null, orderBy: null, result: null};
		tableData.pk = tableData.columns.reduce(function(conso, row) { if (row.pk > 0) { conso.push(row.name); } return conso; }, []);
		if (tableData.pk.length === 0) { // use rowid to delete row ...
			tableData.query = "select rowid, * from "+ tableName;
		} else {
			tableData.query = "select * from "+ tableName;
		}
		return tableData;
		}
	getViewInfo(viewName) {
		var viewData = {type: Structure.VIEW, name: viewName, columns: this.getColumns(viewName), query: "select * from "+ viewName, orderBy: null, result: null};
		return viewData;
	}
	showToTableContainer(container) {	
		this.dialogTable.hide();
		document.getElementById("table-name").innerHTML = (this.currentStructure.type == Structure.VIEW ? "View " : "Table ") +this.currentStructure.name;
		while(document.getElementById("container-table").firstChild) {
			document.getElementById("container-table").removeChild(document.getElementById("container-table").firstChild);
		}
		document.getElementById("container-table").appendChild(container);

		document.getElementById("menu-sqlite-insert").style.display = (this.currentStructure.type == Structure.VIEW ? 'none' : '');
		document.getElementById("menu-sqlite-importCSV").style.display = (this.currentStructure.type == Structure.VIEW ? 'none' : '');

		this.dialogTable.show();
	}
	exportResult(type) {
		switch (type) {
			case 'csv':
			default:
				if (!this.currentQuery) {
					alert('You must execute a query before you can export!');
					return;
				}
				this.exportFile({data: this.getExportData(this.currentQuery), filename: "file.csv", mime: 'text/csv'});
				break;
		}
	}
	exportTable(type) {
		switch (type) {
			case 'csv':
			default:
				this.exportFile({data: this.getExportData(this.currentStructure), filename: "file.csv", mime: 'text/csv'});
				break;
		}
	}
	loadTable(tableName) {
		// this.manageMenu('table', tableName);
		this.currentStructure = this.getTableInfo(tableName);
		var result = this.executeQuery(this.currentStructure);
		// this.selectTab ('row');
		// this.insertView(this.currentStructure);
		this.structureView(tableName, this.currentStructure.type);
		if (result && result.message) {
			this.showToTableContainer(result.containerObj);
		}
	}
	loadView(viewName) {
		// this.manageMenu('view');
		// this.selectTab ('row');
		this.currentStructure = this.getViewInfo(viewName);
		var result = this.executeQuery(this.currentStructure);
		this.structureView(viewName, this.currentStructure.type);
		if (result && result.message) {
			this.showToTableContainer(result.containerObj);
		}
	}
	loadDatabase(all) {
		var self = this;
		var tableList = document.getElementById('table-list');
		this.load('table', "SELECT tbl_name as name FROM sqlite_master WHERE type='table' Order by tbl_name ASC",
			function(row) {
				self.loadTable(row.name);
			}
		);
		if (tableList.style.display == 'none') {
			if (document.getElementById('tablePlus')) document.getElementById('tablePlus').click();
		}
		this.load('view', "SELECT name as name, sql as sql_structure FROM sqlite_master WHERE type='view' Order by name ASC",
			function(row) {
				self.loadView(row.name);
			}
		);	
	}
	format(sql) {
		return sql.replace(new RegExp(',([^0-9])', 'g'), ",\n			$1");
	}
	structureView(tableName, type) {
		if (!type) {
			type = Structure.TABLE;
		}
		var container = document.createElement('div'); 
		container.classList.add('SQLite-WebJS-structure');
		while (container.firstChild) container.removeChild(container.firstChild);
		var containerSQL = document.createElement('div');
		container.appendChild(containerSQL);
		// containerSQL.classList.add('container-action');
		var pre = document.createElement('pre');
		containerSQL.appendChild(pre);
		
		var sql =  this.execute("SELECT sql as sql_structure FROM sqlite_master WHERE type='" + (type == Structure.TABLE ? 'table' : 'view') + "' and tbl_name = '" + tableName + "' ", true);
		if (sql && sql.rows && sql.rows.length) {
			pre.appendChild(document.createTextNode(this.format(sql.rows[0].sql_structure + ';')));
		}

		var indexes =  this.execute("select sql as index_sql from sqlite_master where type = 'index' and tbl_name = '" + tableName + "' and name not like 'sqlite_autoindex_%' and sql is not null", true);
		if (indexes && indexes.rows && indexes.rows.length) {
			var self = this;
			indexes.rows.forEach(function (index) {
				pre.appendChild(document.createTextNode("\n" + self.format(index.index_sql + ';')));
			});
		}
		return container;
	}
	load(type, query, callback) {
		var container = document.getElementById(type + '-list'); 
		while(container.firstChild){
			container.removeChild(container.firstChild);
		}
		var rows = this.execute(query);
		if (rows instanceof Error) {
			container.innerHTML = 'An error has occured';
			return;
		}
		if (rows.length === 0) {
			container.innerHTML = "No " + type;
			return;
		}
		rows.forEach(function(row) {
			var element = document.createElement("div");
			element.appendChild(document.createTextNode(row.name));
			if (callback) {
				(function(r) {
					var todraw = r;
					element.addEventListener('click', function() {
						callback(todraw);
					}, false);
				}(row));
				element.classList.add('SQLite-WebJS-browser-canbeclick');
				element.setAttribute('data-name', 'menu-' + type + '-' + row.name);
			}
			container.appendChild(element);
		});
	}
	getWhereFromPKForCurrentTable(row) {
		var self = this;
		if (this.currentStructure.pk.length) {
			return this.currentStructure.pk.reduce(function(consolidation, key) {
				return (consolidation == '' ? '' : consolidation + " and ") 
					+ key + " = " + self.valueForUpsert(self.getColumnFromCurrentTable(key), row[key], false) + ' ';
			}, '');
		}
		return ' rowid = ' + row.rowid;
		}
	getColumnFromCurrentTable(field) {
		return this.currentStructure.columns.reduce(function(accumulator, currentValue) { if (currentValue.name == field) return currentValue; else return accumulator; }, null);
	}
	executeQuery(options, containerObj = null) {
		var self = this;
		var resultExecute = {message: null, containerObj : containerObj};
		var exportToCSVContainer = document.getElementById((options.type ? 'exportToCSVRowContainer' : 'exportToCSVContainer'));
		options.result = this.execute(options.query + (options && options.orderBy ? options.orderBy : ''), true);
		if (!resultExecute.containerObj) {
			resultExecute.containerObj = document.createElement('div');
		}
		let table = resultExecute.containerObj.querySelector('table');
		if (!table) {
			if (options && [Structure.TABLE, Structure.VIEW].indexOf(options.type) !== -1) {
				// var containerRow = document.getElementById('container-row');
				// while (containerRow.firstChild) containerRow.removeChild(containerRow.firstChild);
				// table = document.getElementById('row-results');
				table = document.createElement('table');
				table.id = 'row-results';
				table.classList.add("SQLite-WebJS-results");
				table.createTHead();
				table.createTBody();
				
				const info = document.createElement('div');
				info.classList.add('SQLite-WebJS-editor-valid');
				info.id = 'table-message';
				info.innerText = '';
				resultExecute.containerObj.appendChild(info);				
				resultExecute.containerObj.appendChild(table);
			} else {
				table = document.getElementById('results');
			}
		}
		var tBody = table.getElementsByTagName('tbody')[0];
		var tHeader = table.getElementsByTagName('thead')[0];
		var rowCount = table.rows.length;
		for (var i = rowCount - 1; i >= 0; i--) {
			table.deleteRow(i);
		}
		
		if (exportToCSVContainer) exportToCSVContainer.style.display = 'none';
		
		if (options.result instanceof Error) {
			throw options.result;
		}
		
		var iLine = 0;
		var iColumn = 0;
		var iCSV = 0;
		var newHeader  = tHeader.insertRow(tHeader.rows.length);
		options.result.columns.forEach(function(field, index) {
			if (index === 0 && options && options.type == Structure.TABLE) {
				newHeader.insertCell(iColumn).appendChild(document.createTextNode('Actions'));
				iColumn++;
				if (!options.pk.length) {
					return;
				}
			} 
			var cell = newHeader.insertCell(iColumn);
			iCSV++;
			cell.appendChild(document.createTextNode(field));
			if (options && [Structure.TABLE, Structure.VIEW].indexOf(options.type) !== -1) {
				var ascButton = document.createElement('span');
				ascButton.innerHTML = "&#x25B2;";
				// ascButton.type = 'button';
				ascButton.classList.add('SQLite-WebJS-browser-order');
				ascButton.onclick = function() {
					self.currentStructure.orderBy = ' ORDER BY ' + field + ' ASC ' ;
					self.executeQuery(self.currentStructure, resultExecute.containerObj);
				};
				cell.appendChild(document.createTextNode(" "));
				cell.appendChild(ascButton);
				cell.appendChild(document.createTextNode(" "));
				var descButton = document.createElement('span');
				descButton.innerHTML = "&#x25BC;";
				descButton.classList.add('SQLite-WebJS-browser-order');
				// descButton.type = 'button';
				descButton.onclick = function() {
					self.currentStructure.orderBy = ' ORDER BY ' + field + ' DESC ' ;
					self.executeQuery(self.currentStructure, resultExecute.containerObj);
				};
				cell.appendChild(descButton);					
			}
		
			iColumn++;
		});

		if (options.result.rows.length) {
			if (exportToCSVContainer) exportToCSVContainer.style.display = '';
			if (options.result.rows.length == 1) resultExecute.message = "1 row";
			else resultExecute.message = options.result.rows.length + " rows";
		}
		else {
			resultExecute.message = "Query has no result";
		}
		if (options && options.type == Structure.TABLE) {
			const info = resultExecute.containerObj.querySelector('#table-message');
			info.innerText = resultExecute.message;
		}
		options.result.rows.forEach(function (row) {				
			iLine++;
			var newRow   = tBody.insertRow(tBody.rows.length);
			if (iLine % 2 === 1) {
				newRow.className = "SQLite-WebJS-results-odd";
			}
			iColumn = 0;
			iCSV = 0;
			options.result.columns.forEach(function (field, index) {
				if (options && options.type == Structure.TABLE && index === 0) {
					// Delete 
					var img = document.createElement('img');
					img.setAttribute('data-name', 'deleteRowButton');
					img.src = './image/error.png';
					img.classList.add('SQLite-WebJS-browser-img-click');
					img.onclick = function () {
						self.execute("Delete from " + options.name 
							+ " Where "
							+ self.getWhereFromPKForCurrentTable(row)
						);
						self.executeQuery(options, resultExecute.containerObj);
						alert('The row has been removed');
					};
					newRow.insertCell(iColumn).appendChild(img);
					iColumn++;
					if (!options.pk.length) {
						return;
					}
				}
				var cellData = newRow.insertCell(iColumn);
				var dataSpan = document.createElement('span');
				dataSpan.appendChild(document.createTextNode((row[field] === null ? '' : row[field])));
				cellData.appendChild(dataSpan);
				if (options && options.type == Structure.TABLE) {
					var column = self.getColumnFromCurrentTable(field);
					var editInput = document.createElement('input');
					editInput.type = "text";
					editInput.value = (row[field] === null ? '' : row[field]);
					editInput.style.display = 'none';
					cellData.appendChild(editInput);
					cellData.ondblclick = function() {
						dataSpan.style.display = 'none';
						editInput.style.display = '';
						editInput.focus();
						// todo: qd perte focus ... edit 
						editInput.onblur = function() {
							editInput.style.display = 'none';
							dataSpan.style.display = '';
							var res = self.execute("Update " + options.name 
								+ " set " + field + " = " + self.valueForUpsert(column, editInput.value, editInput.value == '') 
								+ " Where " + self.getWhereFromPKForCurrentTable(row) );
							if (res instanceof Error) {
								alert("An error has occured: " + (res.message ? res.message : ''));
								return;
							} else {
								row[field] = (editInput.value == '' ? null : editInput.value);
								while(dataSpan.firstChild) dataSpan.removeChild(dataSpan.firstChild);
								dataSpan.appendChild(document.createTextNode((row[field] === null ? '' : row[field])));
							}
		
						};
					};
				}
				iCSV++;
				iColumn++;
			});
		});		
		return resultExecute;
	}
	insertView(tableInfo) {
		const self = this;
		const container = document.createElement('div');
		container.id = "container-insert";
		container.classList.add('SQLite-WebJS-container-center');
		const table = document.createElement('table');
		container.appendChild(table);
		table.id="row-insert";
		table.classList.add('SQLite-WebJS-results');
		const tHeader = table.createTHead();
		tHeader.appendChild(document.createElement('tr'));
		['Column', 'Type', 'Null', 'Value'].forEach(function (c) {
			const th = document.createElement('th');
			th.appendChild(document.createTextNode(c));
			tHeader.firstChild.appendChild(th);
		});
		const tBody = table.createTBody();
		const tfoot = table.createTFoot();
		const th = document.createElement('th');
		th.colSpan = "4";
		tfoot.appendChild(th);
		const containerFoot = document.createElement('div');
		th.appendChild(containerFoot);
		containerFoot.classList.add('SQLite-WebJS-container-center');
		const input = document.createElement('input');
		containerFoot.appendChild(input);
		input.type = "button";
		input.classList.add("SQLite-WebJS-button");
		input.value="Insert";
		input.id="insertElementToTable";
		input.addEventListener('click', function(e) {
			self.insertElementToTable();
		}, false);

		var rowCount = table.rows.length;
		for (var i = rowCount - 2; i > 0; i--) {
			table.deleteRow(i);
		}
		tableInfo.columns.forEach(function (column, index) {
			var newRow   = tBody.insertRow(tBody.rows.length);
			if (index % 2 === 1) {
				newRow.className = "SQLite-WebJS-results-odd";
			}
			newRow.insertCell(0).appendChild(document.createTextNode(column.name));
			
			newRow.insertCell(1).appendChild(document.createTextNode(column.type));
			
			if (tableInfo.pk.indexOf(column.name) === -1) {
				var checkboxNull = document.createElement('input');
				checkboxNull.type = "checkbox";
				checkboxNull.value = "null";
				checkboxNull.name = column.name + "_NULL";
				newRow.insertCell(2).appendChild(checkboxNull);
			} else {
				newRow.insertCell(2);
			}
			if (column.type == 'boolean') {
				var selectAdd = document.createElement('select');
				selectAdd.name = column.name;
				var option=document.createElement("option");
				option.text="true";
				option.value="true";
				selectAdd.add(option, null);
				var option=document.createElement("option");
				option.text="false";
				option.value="false";
				selectAdd.add(option, null);
				newRow.insertCell(3).appendChild(selectAdd);			
			} else {
				var inputAdd = document.createElement('input');
				inputAdd.type = "text";
				inputAdd.value = "";
				inputAdd.name = column.name;
				var cell = newRow.insertCell(3);
				cell.appendChild(inputAdd);
				if (column.type == 'blob') {
					cell.appendChild(document.createTextNode(' (hex literal)'));
				}
			}
		});
		return container;
	}
	insertElementToTable() {
		var self = this;
		var values = '';
		if (!this.currentStructure.columns.some(function (column) {
			var isNull = document.querySelector('#row-insert input[type="checkbox"][name="' + column.name + '_NULL"]');
			var input = document.querySelector('#row-insert input[name="' + column.name + '"]');
			var select = document.querySelector('#row-insert select[name="' + column.name + '"]');
			if (values !== '') {
				values += ", ";
			}
			values += self.valueForUpsert(column, (select ? select[select.selectedIndex].value : input.value), isNull && isNull.checked);
			return false;
		})) {
			var result = this.execute("Insert into "+ this.currentStructure.name + " VALUES (" + values + ") ");
			if (result instanceof Error) {
				alert('An error has occured: ' + result.message);
			} else {
				alert('Your row has been inserted');
				this.loadTable(this.currentStructure.name);
			}
		}
	}
	valueForUpsert(column, value, isNull) {
		if (isNull)  {
			return " null";
		} else if (column.type.toLowerCase() == 'boolean') {
			return value;
		} else if (column.type.toLowerCase().indexOf('char') !== -1 || column.type.toLowerCase() == 'text' || column.type.toLowerCase() == 'clob'
				|| column.type.toLowerCase() == 'datetime' || column.type.toLowerCase() == 'date' ) {
			// CHARACTER(20) VARCHAR(255) VARYING CHARACTER(255) NCHAR(55) NATIVE CHARACTER(70) NVARCHAR(100) TEXT CLOB
			return " '" + value.replace("'", "''") + "'";
		} else if (column.type.toLowerCase() == 'blob') {
			return " X'" + value.replace("'", "''") + "'";
		} else if (value == '' && (column.type.toLowerCase().indexOf('int') !== -1 || ['real', 'double', 'double precision', 'float'].indexOf(column.type.toLowerCase()) !== -1
				|| column.type.toLowerCase() == 'numeric' || column.type.toLowerCase().indexOf('numeric') !== -1 || column.type.toLowerCase().indexOf('decimal') !== -1 )) {
			return " null";
		}
		return value;		
	}
	loadCSVData(data) {
		var self = this;
		var lineArray = data.match(/[^\r\n]+/g);
		var delimiter = document.getElementById('ImportSeparator').value;
		var nullString = document.getElementById('ImportNullString').value;
		var header = document.getElementById('ImportHeader').value;
		var errors = '';
		var nbRowsInserted = 0;
		var nbRowsRejected = 0;
		var columnsToImport = null;
		if (header === 'yes') {
			columnsToImport = [];
			if (lineArray.length === 0) {
				this.resetMessage();	
				this.setMessage('SQLite-WebJS-editor-error', "Empty file");
				return;
			}
			var errorColumnUnknown = false;
			lineArray[0].split(delimiter).forEach(function (columnName) {
				var c = self.currentStructure.columns.reduce(function(accumulator, currentValue) { if (currentValue.name == columnName) return currentValue; else return accumulator; }, null);
				if (c === null) {
					self.resetMessage();	
					self.setMessage('SQLite-WebJS-editor-error', "Unknown " + columnName + " column");
					errorColumnUnknown = true;
					return;
				}
				columnsToImport.push(c);
			});
			if (errorColumnUnknown) {
				return;
			}
		} else {
			columnsToImport = self.currentStructure.columns;
		}
		// begin  run
		lineArray.forEach(function (line, lineIndex) {
			if (header === 'yes' && lineIndex == 0) {
				return;
			}
			var columns = '';
			var values = '';
			var columnArray = line.split(delimiter);
			columnsToImport.forEach(function (column, index) {
				if (columns !== '') columns += ', ';
				columns += column.name;
				if (values !== '') values += ', ';
				values += self.valueForUpsert(column, columnArray[index], index >= columnArray.length || columnArray[index] === nullString);	
			});	
			var result =  self.execute("insert into " + self.currentStructure.name + " (" + columns + ") values (" + values + ")", true);
			if (result instanceof Error) {
				nbRowsRejected++;
				errors += result.message + "\n"; 
			} else {
				nbRowsInserted++;
			}
		});
		// commit
		if (nbRowsInserted > 0) {
			this.loadTable(self.currentStructure.name);
		}
		this.resetMessage();	
		if (nbRowsRejected == 0) {
			this.setMessage('SQLite-WebJS-editor-valid', nbRowsInserted + " rows inserted.");
		} else {		
			this.setMessage('SQLite-WebJS-editor-error', nbRowsRejected + " rows rejected (" + nbRowsInserted + " rows inserted). Details:\n" + errors);
		}
	}
	getExportData(structure) {
		var exportCSV = '';
		var header = document.getElementById('header' + (structure.type ? 'Row' : 'Query')).value;
		var nullString = document.getElementById('nullString' + (structure.type ? 'Row' : '')).value;
		var separator = document.getElementById('separator' + (structure.type ? 'Row' : '')).value;
		if (structure.result) {
			if (header !== 'no') {
				exportCSV += structure.result.columns.reduce(function(conso, columnName, index) {
					if (index == 0 && structure.type && structure.type == Structure.TABLE) {
						if (!structure.pk.length) {
							// rowid: not to export...
							return null;
						}
					}
					return (conso == null ? '' : conso + separator) + columnName;
				}, null);
				exportCSV += "\n";
			}
			structure.result.rows.forEach(function (row) {				
				var iCSV = 0;
				Object.keys(row).forEach(function (field, index) {
					if (structure.type && structure.type == Structure.TABLE && index === 0) {
						if (!structure.pk.length) {
							return;
						}
					}
					exportCSV += (iCSV > 0 ? separator : '') + (row[field] === null ? nullString : row[field]);
					iCSV++;
				});
				exportCSV += "\n";
			});
		}
		return exportCSV;
	}
	reverseDisplay (divId) {
		var div = (typeof divId === 'string' ? document.getElementById(divId) : divId);
		if (div) {
			if (div.style.display == 'none') {
				div.style.display = '';
			} else {
				div.style.display = 'none';
			}
		}
	}
	readSingleFile (e, readAs, callback) {
		var files;
		if (e.target && e.target.files) {
			files = e.target.files;
		} else if (e.dataTransfer && e.dataTransfer.files) 
		{
			files = e.dataTransfer.files;
		}
		if (!files || files.length == 0) {
			callback(null);
			return;
		}
		Array.prototype.forEach.call(files, function(file) { 
			var reader = new FileReader();
			reader.onload = function() {
				callback(reader.result, {file: file});
			};
			if (readAs === ReadModeEnum.ARRAY_BUFFER) reader.readAsArrayBuffer(file);
			else if (readAs === ReadModeEnum.DATA_URL) reader.readAsDataURL(file);
			else reader.readAsText(file);	
		});
	}
	init() {
		var self = this;
		this.message = document.getElementById('editor-message');
		this.myCodeMirror = CodeMirror.fromTextArea(document.getElementById('editor-container'), { lineNumbers: true, viewportMargin: Infinity });
		this.myCodeMirror.setSize(null, 250);
		['table', /*'index', 'sequence', */'view'].forEach(function (structure) {
			var structureTitle = document.getElementById(structure);
			var imgPlus = document.createElement('img');
			var imgMinus = document.createElement('img');
			var fDisplay = function () {
				self.reverseDisplay(structure + '-list');
				self.reverseDisplay(imgMinus.id);
				self.reverseDisplay(imgPlus.id);
			};
			imgPlus.id = structure + 'Plus';
			imgPlus.src = './image/plus.png';
			imgPlus.classList.add('SQLite-WebJS-browser-img-click');
			structureTitle.parentNode.insertBefore(imgPlus, structureTitle);
			imgPlus.onclick = fDisplay;
			imgMinus.id = structure + 'Minus';
			imgMinus.src = './image/minus.png';
			imgMinus.classList.add('SQLite-WebJS-browser-img-click');
			imgMinus.style.display = 'none';
			structureTitle.parentNode.insertBefore(imgMinus, structureTitle);
			imgMinus.onclick = fDisplay;
			structureTitle.onclick = fDisplay;
		});
		
		document.getElementById('file-input').addEventListener('change', function(e) {
			self.resetMessage();
			if (document.getElementById('file-input').value != '') {		
				self.setMessage('SQLite-WebJS-editor-inprogress', "Your database is loading.");
				setTimeout(function() {
					self.readSingleFile(e, ReadModeEnum.ARRAY_BUFFER, function(data) {
						document.getElementById('file-input').value = '';
						self.loadStream(data);
						self.loadDatabase(true);
						self.resetMessage();
						self.setMessage('SQLite-WebJS-editor-valid', "Your database has been loaded.");
					});
				}, 1);
			}
		}, false);

		document.getElementById('csv-file-input').addEventListener('change', function(e) {
			self.resetMessage();
			if (document.getElementById('csv-file-input').value != '') {		
				self.setMessage('SQLite-WebJS-editor-inprogress', "Your CSV file is loading.");
				setTimeout(function() {
					self.readSingleFile(e, ReadModeEnum.TEXT, function(data) {
						document.getElementById('csv-file-input').value = '';
						self.loadCSVData(data);
					});
				}, 1);
			}
		}, false);

		document.getElementById('update').addEventListener('click', function(e) {
			self.resetMessage();
			self.setMessage('SQLite-WebJS-editor-inprogress', "Your database is loading.");
			setTimeout(function() {
				self.loadDatabase(false);
				self.resetMessage();
				self.setMessage('SQLite-WebJS-editor-valid', "Table, view, index and sequence lists have been updated.");
				setTimeout(function () {
					self.resetMessage(['SQLite-WebJS-editor-valid']);
				}, 1000);
			}, 1);
		}, false);
		
		document.getElementById('ExecuteQuery').addEventListener('click', function(e) {
			var selection = self.myCodeMirror.getSelection();
			self.currentQuery = {
				query: (selection != '' && selection != null ? selection : self.myCodeMirror.getValue("\n")), 
				result : null
			}; 
			try {
				var result = self.executeQuery(self.currentQuery);
				if (result && result.message) {
					self.setMessage('SQLite-WebJS-editor-valid', result.message);
				}
			}
			catch (e) {
				self.setMessage('SQLite-WebJS-editor-error', e.message);
			}
		}, false);		
		
		this.dialogData = new A11yDialog(document.getElementById('dialog-data'));
		this.dialogTable = new A11yDialog(document.getElementById('dialog-table'));
		
		this.initMenu();
	}
	closeMenu(exceptMenu = null) {
		document.querySelectorAll('.sub-menu ul').forEach(function(ul) {
		  if (!exceptMenu || exceptMenu !== ul.parentNode) {
			  ul.style.display = 'none';
				ul.parentNode.querySelectorAll("i.arrow").forEach(function(i) {
					i.classList.remove("up");
					i.classList.add("down");
				});
		  }
		});
	}
	initMenu() {
		const self = this;
		this.closeMenu();
		document.querySelectorAll('.sub-menu a').forEach(function(a) {
		  a.onclick = function () {
			  let parent = a.parentNode;
			  while (parent && !parent.classList.contains("sub-menu")) {
				parent = parent.parentNode;
			  }
			  if (parent) {
				self.closeMenu(parent);
				parent.querySelectorAll("ul").forEach(function(ul) {
					if (ul.style.display == '') {
						ul.style.display = 'none';
					} else {
						ul.style.display = '';
					}
				});
				parent.querySelectorAll("i.arrow").forEach(function(i) {
					i.classList.toggle("up");
					i.classList.toggle("down");
				});
			  }
		  };
		});

		document.getElementById("menu-sqlite-exportCSVResults").addEventListener('click', function(e) {
			self.closeMenu();
			document.getElementById("dialog-data-title").innerHTML = 'Export results to CSV';
			document.getElementById("dialog-data-container").innerHTML = `
						<div id="exportToCSVContainer" class="SQLite-WebJS-export-container">
							<br/>
							<table class="SQLite-WebJS-results">
								<tbody>
									<tr>
										<td>
											Separator
										</td>
										<td>
											<select class="select-action" id="separator"><option value=";">Semicolon</option><option value=",">Comma	</option><option value="	">Tab</option></select>
										</td>
									</tr>
									<tr>
										<td>
											NULL string
										</td>
										<td>
											<input id="nullString" type="text" value="\N">
										</td>
									</tr>
									<tr>
										<td>
											Header
										</td>
										<td>
											<select class="select-action" id="headerQuery"><option value="yes">Yes</option><option value="no">No</option></select>
										</td>
									</tr>
								</tbody>
								<tfoot>
									<tr>
										<td colspan="2">
											<div class="SQLite-WebJS-container-center">
												<input type="button" value="export to CSV" id="exportToCSV" onclick="sqliteWebJS.exportResult('csv');" class="SQLite-WebJS-button" />
											</div>
										</td>
									</tr>
								</tfoot>
							</table>
						</div>`;
			self.dialogData.show();
		});		
		document.getElementById("menu-sqlite-openDB").addEventListener('click', function(e) {
			self.closeMenu();
			document.getElementById('file-input').click();
		});
		document.getElementById("menu-sqlite-saveDB").addEventListener('click', function(e) {
			self.closeMenu();
			self.exportDatabaseFile();
		});
		
		document.getElementById('menu-sqlite-exportCSV').addEventListener('click', function(e) {
			const container = document.createElement('div');
			container.innerHTML = `<table class="SQLite-WebJS-results">
							<tbody>
								<tr>
									<td>
										Separator
									</td>
									<td>
										<select class="select-action" id="separatorRow"><option value=";">Semicolon</option><option value=",">Comma	</option><option value="	">Tab</option></select>
									</td>
								</tr>
								<tr>
									<td>
										NULL string
									</td>
									<td>
										<input id="nullStringRow" type="text" value="\N">
									</td>
								</tr>
								<tr>
									<td>
										Header
									</td>
									<td>
										<select class="select-action" id="headerRow"><option value="yes">Yes</option><option value="no">No</option></select>
									</td>
								</tr>
							</tbody>
							<tfoot>
								<tr>
									<td colspan="2">
										<div class="SQLite-WebJS-container-center">
											<input type="button" value="Export to CSV" id="exportToCSVRow" onclick="sqliteWebJS.exportTable('csv');" class="SQLite-WebJS-button" />
										</div>
									</td>
								</tr>
							</tfoot>
						</table>`;
			self.showToTableContainer(container);
		}, false);
		document.getElementById("menu-sqlite-importCSV").addEventListener('click', function(e) {
			self.closeMenu();
			const container = document.createElement('div');
			container.innerHTML = `<div class="SQLite-WebJS-container-center">
				<table class="SQLite-WebJS-results">
					<tbody>
						<tr>
							<td>
								Separator
								<br/> Specifies the character that separates columns within each row
							</td>
							<td>
								<select class="select-action" id="ImportSeparator"><option value=";">Semicolon</option><option value=",">Comma	</option><option value="	">Tab</option></select>
							</td>
						</tr>
						<tr>
							<td>
								NULL string
								<br/> Specifies the string that represents a null value
							</td>
							<td>
								<input id="ImportNullString" type="text" value="\N">
							</td>
						</tr>
						<tr>
							<td>
								Header
								<br/> Specifies that the file contains a header line with the names of column to import
							</td>
							<td>
								<select class="select-action" id="ImportHeader"><option value="yes">Yes</option><option value="no">No</option></select>
							</td>
						</tr>
					</tbody>
					<tfoot>
						<tr>
							<td colspan="2">
								<div class="SQLite-WebJS-container-center">
									<input type="button" class="SQLite-WebJS-button" value="Upload your CSV file" id="selectCSVFile" onclick="sqliteWebJS.selectCSVFile();"/>
								</div>
							</td>
						</tr>
					</tfoot>
				</table>
			</div>`;
			self.showToTableContainer(container);
		});
		document.getElementById("menu-sqlite-insert").addEventListener('click', function(e) {
			self.closeMenu();
			const container = self.insertView(self.currentStructure);
			self.showToTableContainer(container);
		});
		document.getElementById("menu-sqlite-structure").addEventListener('click', function(e) {
			self.closeMenu();
			const container = self.structureView(self.currentStructure.name, self.currentStructure.type);
			self.showToTableContainer(container);
		});
		document.getElementById("menu-sqlite-browse").addEventListener('click', function(e) {
			self.closeMenu();
			if (self.currentStructure.type === Structure.TABLE) {
				self.loadTable(self.currentStructure.name); 
			} else if (self.currentStructure.type === Structure.VIEW) {
				self.loadView(self.currentStructure.name);
			}
		});
		
		document.getElementById("menu-sqlite-openSQL").addEventListener('click', function(e) {
			self.closeMenu();
			document.getElementById('sql-input').click();
		});
		document.getElementById('sql-input').addEventListener('change', function(e) {
			if (document.getElementById('sql-input').value != '') {
				self.readSingleFile(e, ReadModeEnum.TEXT, function(data) {
					document.getElementById('sql-input').value = '';
					self.myCodeMirror.setValue(data);
				});
			}
		});
		document.getElementById("menu-sqlite-saveSQL").addEventListener('click', function(e) {
			self.closeMenu();
			self.exportFile({data: self.myCodeMirror.getValue("\n"), filename: "file.sql", mime: 'text/plain'});
		});
	}
}