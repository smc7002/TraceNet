using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace server.Migrations
{
    /// <inheritdoc />
    public partial class MakeRackIdNullable : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_Devices_Rack_RackId",
                table: "Devices");

            migrationBuilder.DropPrimaryKey(
                name: "PK_Rack",
                table: "Rack");

            migrationBuilder.RenameTable(
                name: "Rack",
                newName: "Racks");

            migrationBuilder.AlterColumn<int>(
                name: "RackId",
                table: "Devices",
                type: "int",
                nullable: true,
                oldClrType: typeof(int),
                oldType: "int");

            migrationBuilder.AddPrimaryKey(
                name: "PK_Racks",
                table: "Racks",
                column: "RackId");

            migrationBuilder.AddForeignKey(
                name: "FK_Devices_Racks_RackId",
                table: "Devices",
                column: "RackId",
                principalTable: "Racks",
                principalColumn: "RackId");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_Devices_Racks_RackId",
                table: "Devices");

            migrationBuilder.DropPrimaryKey(
                name: "PK_Racks",
                table: "Racks");

            migrationBuilder.RenameTable(
                name: "Racks",
                newName: "Rack");

            migrationBuilder.AlterColumn<int>(
                name: "RackId",
                table: "Devices",
                type: "int",
                nullable: false,
                defaultValue: 0,
                oldClrType: typeof(int),
                oldType: "int",
                oldNullable: true);

            migrationBuilder.AddPrimaryKey(
                name: "PK_Rack",
                table: "Rack",
                column: "RackId");

            migrationBuilder.AddForeignKey(
                name: "FK_Devices_Rack_RackId",
                table: "Devices",
                column: "RackId",
                principalTable: "Rack",
                principalColumn: "RackId",
                onDelete: ReferentialAction.Cascade);
        }
    }
}
