import { Controller, Get, Module } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { PrismaModule } from '../prisma/prisma.module';
import { PrismaService } from '../prisma/prisma.service';
@ApiTags('Public catalogs')
@Controller('public')
class PublicCatalogController {
  constructor(private readonly prisma: PrismaService) {}
  @Get('categories') categories() {
    return this.prisma.category.findMany({
      where: { isActive: true },
      select: { id: true, name: true, description: true },
      orderBy: { name: 'asc' },
    });
  }
  @Get('technologies') technologies() {
    return this.prisma.technology.findMany({
      where: {
        isActive: true,
        OR: [{ categoryId: null }, { category: { isActive: true } }],
      },
      select: { id: true, name: true, icon: true, categoryId: true },
      orderBy: { name: 'asc' },
    });
  }
  @Get('technology-categories') technologyCategories() {
    return this.prisma.technologyCategory.findMany({
      where: { isActive: true },
      select: { id: true, name: true, slug: true },
      orderBy: { displayOrder: 'asc' },
    });
  }
}
@Module({
  imports: [PrismaModule],
  controllers: [PublicCatalogController],
})
export class PublicCatalogModule {}
