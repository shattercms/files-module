import { Field, Int, ObjectType } from 'type-graphql';
import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

@ObjectType()
@Entity()
export class File {
  @Field(() => Int)
  @PrimaryGeneratedColumn()
  id!: number;

  @Field()
  @Column()
  filename!: string;

  @Field()
  @Column()
  mimetype!: string;

  @Field({ defaultValue: '{}' })
  @Column({ default: '{}' })
  data!: string;
}
