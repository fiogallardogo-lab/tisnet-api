import { ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { readFileSync, statSync } from 'node:fs';
import { createHash } from 'node:crypto';
export function approvedLegalContent(config: ConfigService) {
  try {
    const path = config.get<string>('LEGAL_CONTENT_FILE');
    if (!path || statSync(path).size > 500000) throw new Error();
    const content = JSON.parse(readFileSync(path, 'utf8'));
    if (
      !content ||
      typeof content.approvalReference !== 'string' ||
      !content.approvalReference.trim() ||
      typeof content.approvedAt !== 'string' ||
      !Number.isFinite(Date.parse(content.approvedAt)) ||
      new Date(content.approvedAt) > new Date()
    )
      throw new Error();
    for (const [key, env] of [
      ['terms', 'TERMS_VERSION'],
      ['privacy', 'PRIVACY_VERSION'],
    ]) {
      const doc = content[key];
      if (
        !doc ||
        typeof doc.version !== 'string' ||
        !doc.version.trim() ||
        doc.version.length > 50 ||
        typeof doc.text !== 'string' ||
        doc.text.trim().length < 20 ||
        doc.text.length > 150000 ||
        doc.version !== config.get<string>(env)?.trim()
      )
        throw new Error();
    }
    return {
      terms: {
        version: content.terms.version as string,
        text: content.terms.text as string,
      },
      privacy: {
        version: content.privacy.version as string,
        text: content.privacy.text as string,
      },
      approvedAt: new Date(content.approvedAt).toISOString(),
      contentHash: createHash('sha256')
        .update(JSON.stringify([content.terms, content.privacy]))
        .digest('hex'),
    };
  } catch {
    throw new ServiceUnavailableException(
      'El contenido legal aprobado aún no está publicado o no coincide con las versiones vigentes.',
    );
  }
}
