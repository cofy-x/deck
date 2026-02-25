/**
 * @license
 * Copyright 2026 cofy-x
 * SPDX-License-Identifier: Apache-2.0
 */
/* global console, process */

import fs from 'node:fs';
import path from 'node:path';

const ROOT_DIR = process.cwd();
const LINK_CHECK_FILES = ['AGENTS.md', '.x/README.md'];
const MODULE_STATUS_FILE = '.x/module-status.md';
const STATUS_VALUES = new Set(['ACTIVE', 'PLACEHOLDER', 'HISTORICAL', 'GENERATED']);

/**
 * @param {string} filePath
 * @returns {string}
 */
function readText(filePath) {
  return fs.readFileSync(filePath, 'utf8');
}

/**
 * @param {string} markdown
 * @returns {string[]}
 */
function extractMarkdownLinks(markdown) {
  const result = [];
  const regex = /\[[^\]]+\]\(([^)]+)\)/g;
  let match = regex.exec(markdown);
  while (match !== null) {
    result.push(match[1].trim());
    match = regex.exec(markdown);
  }
  return result;
}

/**
 * @param {string} linkTarget
 * @returns {boolean}
 */
function isSkippableLink(linkTarget) {
  return (
    linkTarget.startsWith('http://') ||
    linkTarget.startsWith('https://') ||
    linkTarget.startsWith('mailto:') ||
    linkTarget.startsWith('#')
  );
}

/**
 * @param {string} sourceFile
 * @param {string} linkTarget
 * @returns {string}
 */
function resolveRelativeTarget(sourceFile, linkTarget) {
  const stripped = linkTarget.split('#')[0].split('?')[0];
  return path.resolve(path.dirname(sourceFile), stripped);
}

/**
 * @param {string} raw
 * @returns {string}
 */
function stripCodeTicks(raw) {
  return raw.replace(/^`/, '').replace(/`$/, '').trim();
}

/**
 * @param {string} cell
 * @returns {string}
 */
function parseLinkTarget(cell) {
  const match = cell.match(/\[[^\]]+\]\(([^)]+)\)/);
  if (match) {
    return match[1].trim();
  }
  return cell.trim();
}

/**
 * @param {string} cell
 * @returns {string}
 */
function normalizeCellValue(cell) {
  return stripCodeTicks(cell.trim());
}

const errors = [];

for (const file of LINK_CHECK_FILES) {
  const fullPath = path.resolve(ROOT_DIR, file);
  if (!fs.existsSync(fullPath)) {
    errors.push(`[missing-file] ${file}`);
    continue;
  }

  const text = readText(fullPath);
  const links = extractMarkdownLinks(text);
  for (const link of links) {
    if (isSkippableLink(link)) {
      continue;
    }

    const resolved = resolveRelativeTarget(fullPath, link);
    if (!fs.existsSync(resolved)) {
      errors.push(`[broken-link] ${file} -> ${link}`);
    }
  }
}

const moduleStatusPath = path.resolve(ROOT_DIR, MODULE_STATUS_FILE);
if (!fs.existsSync(moduleStatusPath)) {
  errors.push(`[missing-file] ${MODULE_STATUS_FILE}`);
} else {
  const lines = readText(moduleStatusPath).split('\n');
  const tableLines = lines.filter((line) => line.trim().startsWith('|'));
  const dataLines = tableLines.filter((line) => !line.includes('---') && !line.includes('Path | Status |'));

  if (dataLines.length === 0) {
    errors.push('[module-status] no data rows found');
  }

  const rowPaths = new Set();
  for (const line of dataLines) {
    const cells = line
      .split('|')
      .slice(1, -1)
      .map((cell) => cell.trim());

    if (cells.length < 5) {
      errors.push(`[module-status] malformed row: ${line}`);
      continue;
    }

    const modulePath = normalizeCellValue(cells[0]);
    const status = normalizeCellValue(cells[1]);
    const canonicalCell = cells[3];
    const notes = cells[4].trim();

    rowPaths.add(modulePath);

    if (!STATUS_VALUES.has(status)) {
      errors.push(`[module-status] invalid status '${status}' for ${modulePath}`);
    }

    const moduleAbsolutePath = path.resolve(ROOT_DIR, modulePath);
    if (!fs.existsSync(moduleAbsolutePath)) {
      errors.push(`[module-status] module path missing: ${modulePath}`);
    }

    const canonicalTargetRaw = parseLinkTarget(canonicalCell);
    const canonicalTarget = stripCodeTicks(canonicalTargetRaw);

    if (status === 'ACTIVE') {
      if (!canonicalTarget || canonicalTarget === '-') {
        errors.push(`[module-status] ACTIVE module missing canonical doc: ${modulePath}`);
      } else {
        const canonicalResolved = path.resolve(path.dirname(moduleStatusPath), canonicalTarget);
        if (!fs.existsSync(canonicalResolved)) {
          errors.push(`[module-status] canonical doc missing for ${modulePath}: ${canonicalTarget}`);
        }
      }
    }

    if (status === 'PLACEHOLDER' || status === 'HISTORICAL') {
      if (!notes || notes === '-') {
        errors.push(`[module-status] ${status} module missing status notes: ${modulePath}`);
      }
    }
  }

  const topLevelModules = [];
  for (const parent of ['apps', 'packages']) {
    const parentPath = path.resolve(ROOT_DIR, parent);
    if (!fs.existsSync(parentPath)) {
      continue;
    }
    const entries = fs
      .readdirSync(parentPath, { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .map((entry) => `${parent}/${entry.name}`);
    topLevelModules.push(...entries);
  }

  for (const modulePath of topLevelModules) {
    if (!rowPaths.has(modulePath)) {
      errors.push(`[module-status] missing row for ${modulePath}`);
    }
  }
}

if (errors.length > 0) {
  console.error('docs:check failed');
  for (const error of errors) {
    console.error(`- ${error}`);
  }
  process.exit(1);
}

console.log('docs:check passed');
