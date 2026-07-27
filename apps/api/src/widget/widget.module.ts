import { Module } from '@nestjs/common';
import { KnowledgeModule } from '../knowledge/knowledge.module';
import { PublicWidgetController, WidgetController } from './widget.controller';
import { WidgetService } from './widget.service';

@Module({ imports: [KnowledgeModule], controllers: [WidgetController, PublicWidgetController], providers: [WidgetService] })
export class WidgetModule {}
