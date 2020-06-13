"use strict";

const { Builder, By, Key, until } = require('selenium-webdriver');
const { expect } = require('chai');
const config = require('./config.js').config;
const fs = require('fs');
describe('Web GUI for SQLite', () => {
    const driver = new Builder().forBrowser('chrome').build();
    it('should go to sqlite page', async () => {
		await driver.get(config.dir + '/Web-GUI-for-SQLite.html');
    });
    it('Upload a database file', async () => {
		// db has only one table unittest (CREATE TABLE unittest (a varchar(10), b varchar(10))) with 3 rows
		await driver.findElement(By.css('input[id="file-input"]')).sendKeys(config.dir + '/test/test.sqli');
	});
	it('Load table unittest', async () => {
		await (await driver.findElement(By.css('div[data-name="menu-table-unittest"]'))).click();
		await driver.sleep(200); // not pretty
		expect((await driver.findElements(By.css('table[id="row-results"] img[data-name="deleteRowButton"]'))).length).to.equal(3);		
	});
	it('Delete a row in table unittest', async () => {
		var deletButtons = await driver.findElements(By.css('table[id="row-results"] img[data-name="deleteRowButton"]'));
		await deletButtons[1].click();
		await driver.sleep(200);
		driver.switchTo().alert().accept();
		await driver.sleep(200);
		expect((await driver.findElements(By.css('table[id="row-results"] img[data-name="deleteRowButton"]'))).length).to.equal(2);		
	});
	it('Load a CSV file (contains 3 rows) into unittest', async () => {
		await (await driver.findElement(By.css('li a[id="menu-sqlite-importCSV"]'))).click();
		await driver.sleep(200);
		await driver.findElement(By.css('select[id="ImportSeparator"] option[value=","]')).click();
		await driver.findElement(By.css('select[id="ImportHeader"] option[value="yes"]')).click();
		await driver.findElement(By.id('ImportNullString')).clear();
		await driver.findElement(By.id('ImportNullString')).sendKeys('NULLSPE');// NULLSPE represents a null value
		await driver.findElement(By.css('input[id="csv-file-input"]')).sendKeys(config.dir + '/test/test.csv');
		await driver.sleep(200);
		expect((await driver.findElements(By.css('table[id="row-results"] img[data-name="deleteRowButton"]'))).length).to.equal(5);	// 3 - 1 + 3
		await (await driver.findElement(By.css('div[id="dialog-table"] button.dialog-close'))).click();
	});
	it('Execute a select', async () => {
		var codeMirrors = await driver.findElements(By.css('div.CodeMirror'));
		await driver.executeScript("arguments[0].CodeMirror.setValue(\"Select * from unittest\");", codeMirrors[0]);
		await (await driver.findElement(By.id('ExecuteQuery'))).click();
		await driver.sleep(200);
		var rows = await driver.findElements(By.css('table[id="results"] tbody tr'));
		expect(rows.length).to.equal(5);
    });
    after(async () => driver.quit());
});
